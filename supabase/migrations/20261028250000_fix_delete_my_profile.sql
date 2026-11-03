-- 프로필 삭제 RPC를 재설치하고 권한을 다시 부여합니다.
-- 질문·투표·댓글·답글·제안·프로필을 함께 지우며 닉네임을 비웁니다.

create or replace function public.delete_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  if to_regclass('public.comment_likes') is not null then
    delete from public.comment_likes
    where user_id = v_uid
       or comment_id in (
         select id from public.comments where user_id = v_uid
       );
  end if;

  delete from public.comments
  where user_id = v_uid;

  delete from public.votes
  where user_id = v_uid;

  delete from public.questions
  where created_by = v_uid;

  delete from public.question_suggestions
  where user_id = v_uid;

  delete from public.profiles
  where user_id = v_uid;

  return jsonb_build_object('ok', true);
exception
  when others then
    return jsonb_build_object('ok', false, 'code', 'unavailable');
end;
$$;

revoke all on function public.delete_my_profile() from public;
grant execute on function public.delete_my_profile() to authenticated;

notify pgrst, 'reload schema';
