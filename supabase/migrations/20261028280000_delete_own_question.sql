-- 프로필 사용자가 본인이 만든 질문·대기 제안을 삭제할 수 있습니다.

create or replace function public.delete_my_question(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  if not public.has_complete_profile() then
    return jsonb_build_object('ok', false, 'code', 'profile_required');
  end if;

  select created_by into v_owner
  from public.questions
  where id = p_id
  for update;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_owner is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  delete from public.questions where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.delete_my_pending_suggestion(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  if not public.has_complete_profile() then
    return jsonb_build_object('ok', false, 'code', 'profile_required');
  end if;

  select user_id, status::text into v_owner, v_status
  from public.question_suggestions
  where id = p_id
  for update;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_owner is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if v_status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'code', 'already_reviewed');
  end if;

  delete from public.question_suggestions where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.delete_my_question(uuid) from public;
revoke all on function public.delete_my_pending_suggestion(uuid) from public;
grant execute on function public.delete_my_question(uuid) to authenticated;
grant execute on function public.delete_my_pending_suggestion(uuid) to authenticated;
