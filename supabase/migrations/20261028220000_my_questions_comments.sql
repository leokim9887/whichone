-- 내가 만든 질문·내가 쓴 댓글/답글 목록.
-- 기존 질문·댓글·제안 행은 지우지 않습니다.

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

create or replace function public.list_my_comments()
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
      select jsonb_agg(row.item order by row.created_at desc)
      from (
        select
          c.created_at,
          jsonb_build_object(
            'id', c.id,
            'questionId', c.question_id,
            'questionTitle', q.title,
            'questionStatus', q.status::text,
            'body', c.body,
            'createdAt', c.created_at,
            'isReply', (c.parent_id is not null),
            'parentId', c.parent_id,
            'optionId', c.option_id
          ) as item
        from public.comments c
        join public.questions q on q.id = c.question_id
        where c.user_id = auth.uid()
          and c.status = 'visible'
          and q.status = 'published'
        order by c.created_at desc
        limit 100
      ) row
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_my_questions() from public;
revoke all on function public.list_my_comments() from public;
grant execute on function public.list_my_questions() to authenticated;
grant execute on function public.list_my_comments() to authenticated;

notify pgrst, 'reload schema';
