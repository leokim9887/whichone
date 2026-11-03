-- 오늘(KST) 질문 작성 가능 여부를 조회합니다.

create or replace function public.my_question_write_quota()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_used integer := 0;
  v_limit integer := 3;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  if not public.has_complete_profile() then
    return jsonb_build_object('ok', false, 'code', 'profile_required');
  end if;

  select count(*)::integer into v_used
  from public.question_suggestions
  where user_id = auth.uid()
    and (created_at at time zone 'Asia/Seoul')::date = v_today;

  return jsonb_build_object(
    'ok', true,
    'used', v_used,
    'limit', v_limit,
    'allowed', v_used < v_limit
  );
end;
$$;

revoke all on function public.my_question_write_quota() from public;
grant execute on function public.my_question_write_quota() to authenticated;
