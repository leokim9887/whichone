-- 내 질문 삭제가 안정적으로 동작하도록 소유권 판정과 예외 처리를 보강합니다.

create or replace function public.delete_my_question(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_exists boolean := false;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  if not public.has_complete_profile() then
    return jsonb_build_object('ok', false, 'code', 'profile_required');
  end if;

  select true, created_by into v_exists, v_owner
  from public.questions
  where id = p_id
  for update;

  if not coalesce(v_exists, false) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_owner is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  begin
    delete from public.questions where id = p_id;
  exception
    when others then
      -- 하드 삭제가 막히면 공개 목록에서만 내립니다.
      update public.questions
      set status = 'hidden'::public.question_status
      where id = p_id
        and created_by = auth.uid();
  end;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.list_my_questions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  return jsonb_build_object(
    'ok', true,
    'items', coalesce((
      select jsonb_agg(item order by item_created_at desc)
      from (
        select
          q.created_at as item_created_at,
          jsonb_build_object(
            'id', q.id,
            'title', q.title,
            'status', q.status::text,
            'source', 'question',
            'category', q.category,
            'topic', q.topic,
            'publishedAt', q.published_at,
            'createdAt', q.created_at,
            'participantCount', (
              select count(*)::int from public.votes v where v.question_id = q.id
            ),
            'commentCount', (
              select count(*)::int
              from public.comments c
              where c.question_id = q.id and c.status = 'visible'
            )
          ) as item
        from public.questions q
        where q.created_by = auth.uid()
          and q.status <> 'hidden'

        union all

        select
          s.created_at as item_created_at,
          jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'status', s.status::text,
            'source', 'suggestion',
            'category', s.category,
            'topic', s.topic,
            'publishedAt', null,
            'createdAt', s.created_at,
            'participantCount', 0,
            'commentCount', 0
          ) as item
        from public.question_suggestions s
        where s.user_id = auth.uid()
          and s.status = 'pending'
      ) listed
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.delete_my_question(uuid) from public;
grant execute on function public.delete_my_question(uuid) to authenticated;
grant execute on function public.delete_my_question(uuid) to anon;

notify pgrst, 'reload schema';
