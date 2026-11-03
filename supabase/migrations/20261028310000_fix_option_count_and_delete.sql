-- 원인: 질문 삭제 시 options 연쇄 삭제가 option_count 트리거(23514)에 막힘.
-- 1) 질문이 없으면 선택지 개수 검사를 건너뜀
-- 2) 사용자 삭제는 우선 비공개(hidden) 처리로 확실히 동작하게 함

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

  if qid is null then
    return null;
  end if;

  -- 질문이 이미 지워졌거나 지워지는 중이면 통과
  if not exists (select 1 from public.questions where id = qid) then
    return null;
  end if;

  select count(*) into cnt from public.options where question_id = qid;
  if cnt < 2 or cnt > 4 then
    raise exception 'option_count' using errcode = '23514';
  end if;
  return null;
end;
$$;

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

  -- options 연쇄 삭제 트리거를 피하기 위해 비공개 처리
  update public.questions
  set status = 'hidden'::public.question_status
  where id = p_id
    and created_by = auth.uid();

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

-- admin 하드 삭제도 트리거 수정 후 동작해야 함
create or replace function public.admin_delete_question(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if not exists (select 1 from public.questions where id = p_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  delete from public.questions where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.delete_my_question(uuid) from public;
grant execute on function public.delete_my_question(uuid) to authenticated;
grant execute on function public.delete_my_question(uuid) to anon;
grant execute on function public.enforce_option_count() to authenticated;

notify pgrst, 'reload schema';
