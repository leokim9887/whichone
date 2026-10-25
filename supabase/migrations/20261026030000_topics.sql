-- 세부 주제를 추가합니다. 기존 투표와 질문은 지우지 않습니다.
-- SQL Editor에서 이 파일 전체를 한 번 실행합니다.

alter table public.questions add column if not exists topic text;
alter table public.question_suggestions add column if not exists topic text;

update public.questions set topic = 'routine' where id = '10000000-0000-4000-8000-000000000001' and topic is null;
update public.questions set topic = 'habit' where id = '10000000-0000-4000-8000-000000000002' and topic is null;
update public.questions set topic = 'time' where id = '10000000-0000-4000-8000-000000000003' and topic is null;
update public.questions set topic = 'boundary' where id = '10000000-0000-4000-8000-000000000004' and topic is null;
update public.questions set topic = 'date' where id = '10000000-0000-4000-8000-000000000005' and topic is null;
update public.questions set topic = 'contact' where id = '10000000-0000-4000-8000-000000000006' and topic is null;
update public.questions set topic = 'save' where id = '10000000-0000-4000-8000-000000000007' and topic is null;
update public.questions set topic = 'income' where id = '10000000-0000-4000-8000-000000000008' and topic is null;
update public.questions set topic = 'windfall' where id = '10000000-0000-4000-8000-000000000009' and topic is null;
update public.questions set topic = 'people' where id = '10000000-0000-4000-8000-000000000010' and topic is null;
update public.questions set topic = 'task' where id = '10000000-0000-4000-8000-000000000011' and topic is null;
update public.questions set topic = 'pay' where id = '10000000-0000-4000-8000-000000000012' and topic is null;
update public.questions set topic = 'menu' where id = '10000000-0000-4000-8000-000000000013' and topic is null;
update public.questions set topic = 'alone' where id = '10000000-0000-4000-8000-000000000014' and topic is null;
update public.questions set topic = 'together' where id = '10000000-0000-4000-8000-000000000015' and topic is null;
update public.questions set topic = 'relation' where id = '10000000-0000-4000-8000-000000000016' and topic is null;
update public.questions set topic = 'help' where id = '10000000-0000-4000-8000-000000000017' and topic is null;
update public.questions set topic = 'rest' where id = '10000000-0000-4000-8000-000000000018' and topic is null;

drop function if exists public.submit_suggestion(text, text, text, jsonb);

create or replace function public.list_published_questions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'title', q.title,
        'description', q.description,
        'category', q.category,
        'topic', q.topic,
        'publishedAt', q.published_at,
        'createdAt', q.created_at,
        'dailyFeatureDate', q.daily_feature_date,
        'participantCount', (
          select count(*) from public.votes v where v.question_id = q.id
        ),
        'options', '[]'::jsonb
      )
      order by q.published_at desc
    ),
    '[]'::jsonb
  )
  from public.questions q
  where q.status = 'published';
$$;

create or replace function public.get_published_question(p_question_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q public.questions%rowtype;
  opts jsonb;
begin
  select * into q from public.questions where id = p_question_id;
  if not found then
    return jsonb_build_object('state', 'missing');
  end if;
  if q.status <> 'published' then
    return jsonb_build_object('state', 'unpublished');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', o.id, 'text', o.text, 'position', o.position)
      order by o.position
    ),
    '[]'::jsonb
  )
  into opts
  from public.options o
  where o.question_id = q.id;

  return jsonb_build_object(
    'state', 'ok',
    'question', jsonb_build_object(
      'id', q.id,
      'title', q.title,
      'description', q.description,
      'category', q.category,
      'topic', q.topic,
      'publishedAt', q.published_at,
      'createdAt', q.created_at,
      'dailyFeatureDate', q.daily_feature_date,
      'participantCount', (select count(*) from public.votes v where v.question_id = q.id),
      'options', opts
    )
  );
end;
$$;

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
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  v_title := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
  v_description := nullif(btrim(regexp_replace(coalesce(p_description, ''), '\s+', ' ', 'g')), '');

  if char_length(v_title) < 1 or char_length(v_title) > 100 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if v_description is not null and char_length(v_description) > 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

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

  begin
    v_category := p_category::public.question_category;
  exception
    when invalid_text_representation then
      return jsonb_build_object('ok', false, 'code', 'invalid');
  end;

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
    select count(*)
    from public.question_suggestions
    where user_id = auth.uid()
      and created_at > now() - interval '1 day'
  ) >= 5 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  insert into public.question_suggestions (title, description, category, topic, options, user_id, status)
  values (v_title, v_description, v_category, p_topic, to_jsonb(cleaned), auth.uid(), 'pending');

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  return jsonb_build_object(
    'ok', true,
    'suggestions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'description', s.description,
          'category', s.category,
          'topic', s.topic,
          'options', s.options,
          'createdAt', s.created_at
        )
        order by s.created_at asc
      )
      from public.question_suggestions s
      where s.status = 'pending'
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'targetType', r.target_type,
          'targetId', r.target_id,
          'reason', r.reason,
          'createdAt', r.created_at,
          'preview', case
            when r.target_type = 'question' then coalesce(
              (select title from public.questions where id = r.target_id),
              '질문을 찾을 수 없습니다'
            )
            else coalesce(
              (select left(body, 120) from public.comments where id = r.target_id),
              '의견을 찾을 수 없습니다'
            )
          end
        )
        order by r.created_at asc
      )
      from public.reports r
      where r.status = 'open'
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'title', q.title,
          'category', q.category,
          'topic', q.topic,
          'status', q.status,
          'participantCount', (select count(*) from public.votes v where v.question_id = q.id),
          'publishedAt', q.published_at,
          'dailyFeatureDate', q.daily_feature_date
        )
        order by q.created_at desc
      )
      from (
        select *
        from public.questions
        order by created_at desc
        limit 100
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_review_suggestion(p_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.question_suggestions%rowtype;
  new_question uuid;
  opt text;
  pos integer := 0;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  select * into s from public.question_suggestions where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if s.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'already_reviewed');
  end if;

  if p_decision = 'rejected' then
    update public.question_suggestions
    set status = 'rejected', reviewed_at = now()
    where id = p_id;
    return jsonb_build_object('ok', true);
  end if;

  insert into public.questions (title, description, category, topic, status, published_at, created_by)
  values (s.title, s.description, s.category, s.topic, 'published', now(), s.user_id)
  returning id into new_question;

  for opt in select value from jsonb_array_elements_text(s.options) as t(value)
  loop
    insert into public.options (question_id, text, position)
    values (new_question, opt, pos);
    pos := pos + 1;
  end loop;

  update public.question_suggestions
  set status = 'approved', reviewed_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'questionId', new_question);
end;
$$;

revoke all on function public.submit_suggestion(text, text, text, text, jsonb) from public;
grant execute on function public.submit_suggestion(text, text, text, text, jsonb) to authenticated;
notify pgrst, 'reload schema';
