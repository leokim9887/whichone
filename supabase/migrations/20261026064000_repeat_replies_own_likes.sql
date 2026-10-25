-- 한 사람이 같은 의견에 답글을 여러 번 남기고, 자신이 쓴 글도 추천할 수 있게 합니다.
-- 기존 의견, 답글, 추천, 투표 행은 지우지 않습니다.

drop index if exists public.comments_one_reply_per_user;

create or replace function public.add_comment_reply(
  p_question_id uuid,
  p_parent_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_option uuid;
  v_parent_question uuid;
  v_parent_parent uuid;
  v_parent_status public.comment_status;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  v_body := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  if char_length(v_body) < 1 or char_length(v_body) > 300 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  select question_id, parent_id, status
    into v_parent_question, v_parent_parent, v_parent_status
  from public.comments
  where id = p_parent_id;

  if v_parent_question is null
     or v_parent_question is distinct from p_question_id
     or v_parent_parent is not null
     or v_parent_status is distinct from 'visible' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
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

  insert into public.comments (question_id, option_id, user_id, body, status, parent_id)
  values (p_question_id, v_option, auth.uid(), v_body, 'visible', p_parent_id);

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.toggle_comment_like(
  p_question_id uuid,
  p_comment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.comment_status;
  v_question uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  select status, question_id
    into v_status, v_question
  from public.comments
  where id = p_comment_id;

  if v_question is null
     or v_question is distinct from p_question_id
     or v_status is distinct from 'visible' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if not exists (
    select 1 from public.questions
    where id = p_question_id and status = 'published'
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if not exists (
    select 1 from public.votes
    where question_id = p_question_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'code', 'vote_required');
  end if;

  delete from public.comment_likes
  where comment_id = p_comment_id and user_id = auth.uid();

  if found then
    return jsonb_build_object('ok', true);
  end if;

  insert into public.comment_likes (comment_id, user_id)
  values (p_comment_id, auth.uid());

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', true);
end;
$$;

notify pgrst, 'reload schema';
