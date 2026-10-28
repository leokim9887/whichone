-- 본인이 남긴 의견과 답글을 수정하거나 삭제할 수 있게 합니다.
-- 기존 의견, 답글, 추천, 투표 행은 지우지 않습니다.
-- 삭제는 status를 deleted로 바꾸고, 루트 의견을 지우면 그 아래 답글도 함께 삭제됩니다.

create or replace function public.edit_own_comment(
  p_question_id uuid,
  p_comment_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_owner uuid;
  v_status public.comment_status;
  v_question uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  v_body := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  if char_length(v_body) < 1 or char_length(v_body) > 300 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  select user_id, status, question_id
    into v_owner, v_status, v_question
  from public.comments
  where id = p_comment_id
  for update;

  if v_owner is null
     or v_question is distinct from p_question_id
     or v_status is distinct from 'visible' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_owner is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if not exists (
    select 1 from public.questions
    where id = p_question_id and status = 'published'
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  update public.comments
  set body = v_body
  where id = p_comment_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.delete_own_comment(
  p_question_id uuid,
  p_comment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status public.comment_status;
  v_question uuid;
  v_parent uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  select user_id, status, question_id, parent_id
    into v_owner, v_status, v_question, v_parent
  from public.comments
  where id = p_comment_id
  for update;

  if v_owner is null
     or v_question is distinct from p_question_id
     or v_status = 'deleted' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_owner is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if not exists (
    select 1 from public.questions
    where id = p_question_id and status = 'published'
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_parent is null then
    update public.comments
    set status = 'deleted'
    where parent_id = p_comment_id
      and status <> 'deleted';
  end if;

  update public.comments
  set status = 'deleted'
  where id = p_comment_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- 루트 의견을 삭제한 뒤에는 같은 질문에서 새 의견을 다시 남길 수 있게 합니다.
drop index if exists public.comments_one_root_per_user;
create unique index if not exists comments_one_visible_root_per_user
  on public.comments (question_id, user_id)
  where parent_id is null and status <> 'deleted';

create or replace function public.add_comment(p_question_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_option uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  v_body := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  if char_length(v_body) < 1 or char_length(v_body) > 300 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  if not exists (
    select 1 from public.questions
    where id = p_question_id and status = 'published'
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select option_id into v_option
  from public.votes
  where question_id = p_question_id and user_id = auth.uid();

  if v_option is null then
    return jsonb_build_object('ok', false, 'code', 'vote_required');
  end if;

  if exists (
    select 1 from public.comments
    where question_id = p_question_id
      and user_id = auth.uid()
      and parent_id is null
      and status <> 'deleted'
  ) then
    return jsonb_build_object('ok', false, 'code', 'already_commented');
  end if;

  insert into public.comments (question_id, option_id, user_id, body, status, parent_id)
  values (p_question_id, v_option, auth.uid(), v_body, 'visible', null);

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'already_commented');
end;
$$;

create or replace function public.enforce_comment_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  voted_option uuid;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'user_mismatch' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' and new.status is distinct from 'visible' then
    raise exception 'status_locked' using errcode = '42501';
  end if;

  select option_id into voted_option
  from public.votes
  where question_id = new.question_id
    and user_id = new.user_id;

  if voted_option is null then
    raise exception 'vote_required' using errcode = '42501';
  end if;

  if new.option_id is distinct from voted_option then
    raise exception 'option_mismatch' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.questions
    where id = new.question_id and status = 'published'
  ) then
    raise exception 'not_published' using errcode = '42501';
  end if;

  if new.parent_id is not null then
    if not exists (
      select 1
      from public.comments parent
      where parent.id = new.parent_id
        and parent.question_id = new.question_id
        and parent.parent_id is null
        and parent.status = 'visible'
    ) then
      raise exception 'parent_invalid' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.edit_own_comment(uuid, uuid, text) from public;
revoke all on function public.delete_own_comment(uuid, uuid) from public;
revoke all on function public.add_comment(uuid, text) from public;
revoke all on function public.enforce_comment_integrity() from public;

grant execute on function public.edit_own_comment(uuid, uuid, text) to authenticated;
grant execute on function public.delete_own_comment(uuid, uuid) to authenticated;
grant execute on function public.add_comment(uuid, text) to authenticated;
grant execute on function public.enforce_comment_integrity() to authenticated;

notify pgrst, 'reload schema';
