-- 이미 투표한 질문도 선택지를 다시 바꿀 수 있게 함

create or replace function public.cast_vote(p_question_id uuid, p_option_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q_status public.question_status;
  updated_rows integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  if not public.has_complete_profile() then
    return jsonb_build_object('ok', false, 'code', 'profile_required');
  end if;

  select status into q_status from public.questions where id = p_question_id;
  if q_status is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if q_status <> 'published' then
    return jsonb_build_object('ok', false, 'code', 'unpublished');
  end if;

  if not exists (
    select 1 from public.options
    where id = p_option_id and question_id = p_question_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  update public.votes
  set option_id = p_option_id
  where question_id = p_question_id
    and user_id = auth.uid();

  get diagnostics updated_rows = row_count;
  if updated_rows > 0 then
    return jsonb_build_object('ok', true, 'changed', true);
  end if;

  insert into public.votes (question_id, option_id, user_id)
  values (p_question_id, p_option_id, auth.uid());

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    update public.votes
    set option_id = p_option_id
    where question_id = p_question_id
      and user_id = auth.uid();
    return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

revoke all on function public.cast_vote(uuid, uuid) from public;
grant execute on function public.cast_vote(uuid, uuid) to authenticated;
grant execute on function public.cast_vote(uuid, uuid) to anon;

notify pgrst, 'reload schema';
