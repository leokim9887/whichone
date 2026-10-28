-- 프로필(닉네임·사진) 삭제. 투표·댓글 행은 지우지 않습니다.

create or replace function public.delete_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  delete from public.profiles where user_id = auth.uid();

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.delete_my_profile() from public;
grant execute on function public.delete_my_profile() to authenticated;

notify pgrst, 'reload schema';
