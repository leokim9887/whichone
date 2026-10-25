-- 이미 init SQL을 실행한 프로젝트에서 한 번만 실행합니다.
-- 질문 승인 시 선택지 검사 트리거가 관리자 세션 권한으로 실행되며 저장이 취소되던 문제를 고칩니다.

create or replace function public.enforce_vote_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q_status public.question_status;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'user_mismatch' using errcode = '42501';
  end if;

  select status into q_status from public.questions where id = new.question_id;
  if q_status is distinct from 'published' then
    raise exception 'not_published' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.options
    where id = new.option_id
      and question_id = new.question_id
  ) then
    raise exception 'option_mismatch' using errcode = '23514';
  end if;

  return new;
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

  if new.status is distinct from 'visible' then
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

  return new;
end;
$$;

create or replace function public.enforce_option_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qid uuid;
  cnt integer;
begin
  qid := coalesce(new.question_id, old.question_id);
  select count(*) into cnt from public.options where question_id = qid;
  if cnt < 2 or cnt > 4 then
    raise exception 'option_count' using errcode = '23514';
  end if;
  return null;
end;
$$;

grant execute on function public.touch_updated_at() to authenticated;
grant execute on function public.enforce_vote_integrity() to authenticated;
grant execute on function public.enforce_comment_integrity() to authenticated;
grant execute on function public.enforce_option_count() to authenticated;
