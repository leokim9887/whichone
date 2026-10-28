-- 프로필 삭제 시 해당 사용자의 질문·투표·댓글·답글·제안도 함께 지우고 닉네임을 비웁니다.

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

  delete from public.comment_likes
  where user_id = v_uid
     or comment_id in (
       select id from public.comments where user_id = v_uid
     );

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
end;
$$;

notify pgrst, 'reload schema';
