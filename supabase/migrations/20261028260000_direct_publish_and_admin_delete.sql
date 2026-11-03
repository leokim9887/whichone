-- 프로필이 있는 사용자는 질문을 바로 공개합니다.
-- 운영자는 질문을 완전히 삭제할 수 있습니다.

create or replace function public.submit_suggestion(
  p_title text,
  p_description text,
  p_category text,
  p_topic text,
  p_options jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_description text;
  v_category public.question_category;
  opt text;
  normalized text;
  seen text[] := array[]::text[];
  cleaned text[] := array[]::text[];
  new_question uuid;
  pos integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  if not public.has_complete_profile() then
    return jsonb_build_object('ok', false, 'code', 'profile_required');
  end if;

  v_title := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
  v_description := nullif(btrim(regexp_replace(coalesce(p_description, ''), '\s+', ' ', 'g')), '');

  if char_length(v_title) < 1 or char_length(v_title) > 100 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if v_description is not null and char_length(v_description) > 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  begin
    v_category := p_category::public.question_category;
  exception
    when invalid_text_representation then
      return jsonb_build_object('ok', false, 'code', 'invalid');
  end;

  if not (
    (v_category = 'daily' and p_topic in ('routine', 'time', 'habit'))
    or (v_category = 'love' and p_topic in ('contact', 'boundary', 'date'))
    or (v_category = 'money' and p_topic in ('save', 'income', 'windfall'))
    or (v_category = 'work' and p_topic in ('task', 'people', 'pay'))
    or (v_category = 'food' and p_topic in ('menu', 'alone', 'together'))
    or (v_category = 'values' and p_topic in ('relation', 'help', 'rest'))
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  if jsonb_typeof(p_options) is distinct from 'array'
     or jsonb_array_length(p_options) < 2
     or jsonb_array_length(p_options) > 4 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  for opt in select value from jsonb_array_elements_text(p_options) as t(value)
  loop
    normalized := btrim(regexp_replace(opt, '\s+', ' ', 'g'));
    if char_length(normalized) < 1 or char_length(normalized) > 60 or normalized = any (seen) then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    seen := array_append(seen, normalized);
    cleaned := array_append(cleaned, normalized);
  end loop;

  if (
    (
      select count(*)
      from public.questions
      where created_by = auth.uid()
        and created_at > now() - interval '1 day'
    )
    + (
      select count(*)
      from public.question_suggestions
      where user_id = auth.uid()
        and created_at > now() - interval '1 day'
        and status = 'pending'
    )
  ) >= 5 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  insert into public.questions (title, description, category, topic, status, published_at, created_by)
  values (v_title, v_description, v_category, p_topic, 'published', now(), auth.uid())
  returning id into new_question;

  foreach opt in array cleaned
  loop
    insert into public.options (question_id, text, position)
    values (new_question, opt, pos);
    pos := pos + 1;
  end loop;

  insert into public.question_suggestions (title, description, category, topic, options, user_id, status, reviewed_at)
  values (v_title, v_description, v_category, p_topic, to_jsonb(cleaned), auth.uid(), 'approved', now());

  return jsonb_build_object('ok', true, 'questionId', new_question);
end;
$$;

create or replace function public.admin_delete_question(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if not exists (select 1 from public.questions where id = p_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  delete from public.questions where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_resolve_report(p_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reports%rowtype;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_action not in ('dismiss', 'hide', 'remove') then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  select * into r from public.reports where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if r.status <> 'open' then
    return jsonb_build_object('ok', false, 'code', 'already_reviewed');
  end if;

  if p_action = 'dismiss' then
    update public.reports set status = 'dismissed' where id = p_id;
    return jsonb_build_object('ok', true);
  end if;

  if r.target_type = 'comment' then
    update public.comments
    set status = case when p_action = 'remove' then 'deleted'::public.comment_status else 'hidden'::public.comment_status end
    where id = r.target_id;
  elsif p_action = 'remove' then
    delete from public.questions where id = r.target_id;
  else
    update public.questions
    set status = 'hidden'
    where id = r.target_id;
  end if;

  update public.reports set status = 'reviewed' where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_suggestion(text, text, text, text, jsonb) from public;
revoke all on function public.admin_delete_question(uuid) from public;
revoke all on function public.admin_resolve_report(uuid, text) from public;

grant execute on function public.submit_suggestion(text, text, text, text, jsonb) to authenticated;
grant execute on function public.admin_delete_question(uuid) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;

notify pgrst, 'reload schema';
