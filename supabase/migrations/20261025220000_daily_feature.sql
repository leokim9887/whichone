-- 운영 화면에서 오늘의 질문을 날짜별로 지정합니다. SQL Editor에서 이 파일 전체를 한 번 실행합니다.

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  return jsonb_build_object(
    'ok', true,
    'suggestions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'description', s.description,
          'category', s.category,
          'topic', s.topic,
          'options', s.options,
          'createdAt', s.created_at
        )
        order by s.created_at asc
      )
      from public.question_suggestions s
      where s.status = 'pending'
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'targetType', r.target_type,
          'targetId', r.target_id,
          'reason', r.reason,
          'createdAt', r.created_at,
          'preview', case
            when r.target_type = 'question' then coalesce(
              (select title from public.questions where id = r.target_id),
              '질문을 찾을 수 없습니다'
            )
            else coalesce(
              (select left(body, 120) from public.comments where id = r.target_id),
              '의견을 찾을 수 없습니다'
            )
          end
        )
        order by r.created_at asc
      )
      from public.reports r
      where r.status = 'open'
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'title', q.title,
          'category', q.category,
          'topic', q.topic,
          'status', q.status,
          'participantCount', (select count(*) from public.votes v where v.question_id = q.id),
          'publishedAt', q.published_at,
          'dailyFeatureDate', q.daily_feature_date
        )
        order by q.created_at desc
      )
      from (
        select *
        from public.questions
        order by created_at desc
        limit 100
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_set_daily_feature(p_id uuid, p_date text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if not exists (select 1 from public.questions where id = p_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if p_date is null or btrim(p_date) = '' then
    update public.questions
    set daily_feature_date = null
    where id = p_id;
    return jsonb_build_object('ok', true);
  end if;

  if p_date !~ '^\d{4}-\d{2}-\d{2}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  begin
    v_date := p_date::date;
  exception
    when others then
      return jsonb_build_object('ok', false, 'code', 'invalid');
  end;

  if not exists (
    select 1 from public.questions
    where id = p_id and status = 'published'
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  update public.questions
  set daily_feature_date = null
  where daily_feature_date = v_date
    and id <> p_id;

  update public.questions
  set daily_feature_date = v_date
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_set_daily_feature(uuid, text) to authenticated;
notify pgrst, 'reload schema';
