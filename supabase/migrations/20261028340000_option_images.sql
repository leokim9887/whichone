-- 질문 단위 사진 → 선택지별 사진(부가 설명)

alter table public.options
  add column if not exists image_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'options_image_url_len'
      and conrelid = 'public.options'::regclass
  ) then
    alter table public.options
      add constraint options_image_url_len
      check (
        image_url is null
        or (
          char_length(image_url) between 8 and 500
          and image_url ~* '^https?://'
        )
      );
  end if;
end;
$$;

create or replace function public.list_published_questions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'title', q.title,
        'description', q.description,
        'category', q.category,
        'topic', q.topic,
        'publishedAt', q.published_at,
        'createdAt', q.created_at,
        'dailyFeatureDate', q.daily_feature_date,
        'participantCount', (
          select count(*) from public.votes v where v.question_id = q.id
        ),
        'commentCount', (
          select count(*)
          from public.comments c
          where c.question_id = q.id
            and c.status = 'visible'
        ),
        'authorNickname', null,
        'authorAvatarUrl', null,
        'options', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', o.id,
              'text', o.text,
              'position', o.position,
              'imageUrl', o.image_url
            )
            order by o.position
          )
          from public.options o
          where o.question_id = q.id
        ), '[]'::jsonb)
      )
      order by q.published_at desc
    ),
    '[]'::jsonb
  )
  from public.questions q
  where q.status = 'published';
$$;

create or replace function public.get_published_question(p_question_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q public.questions%rowtype;
  opts jsonb;
begin
  select * into q from public.questions where id = p_question_id;
  if not found then
    return jsonb_build_object('state', 'missing');
  end if;
  if q.status <> 'published' then
    return jsonb_build_object('state', 'unpublished');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'text', o.text,
        'position', o.position,
        'imageUrl', o.image_url
      )
      order by o.position
    ),
    '[]'::jsonb
  )
  into opts
  from public.options o
  where o.question_id = q.id;

  return jsonb_build_object(
    'state', 'ok',
    'question', jsonb_build_object(
      'id', q.id,
      'title', q.title,
      'description', q.description,
      'category', q.category,
      'topic', q.topic,
      'publishedAt', q.published_at,
      'createdAt', q.created_at,
      'dailyFeatureDate', q.daily_feature_date,
      'participantCount', (select count(*) from public.votes v where v.question_id = q.id),
      'commentCount', (
        select count(*)
        from public.comments c
        where c.question_id = q.id
          and c.status = 'visible'
      ),
      'authorNickname', null,
      'authorAvatarUrl', null,
      'options', opts
    )
  );
end;
$$;

drop function if exists public.submit_suggestion(text, text, text, text, jsonb);
drop function if exists public.submit_suggestion(text, text, text, text, jsonb, jsonb);

create or replace function public.submit_suggestion(
  p_title text,
  p_description text,
  p_category text,
  p_topic text,
  p_options jsonb,
  p_option_images jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_description text;
  v_category public.question_category;
  opt text;
  normalized text;
  seen text[] := array[]::text[];
  cleaned text[] := array[]::text[];
  image_item text;
  v_images text[] := array[]::text[];
  image_count integer := 0;
  new_question uuid;
  pos integer := 0;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  if not public.has_complete_profile() then
    return jsonb_build_object('ok', false, 'code', 'profile_required');
  end if;

  v_title := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
  v_description := nullif(btrim(regexp_replace(coalesce(p_description, ''), '\s+', ' ', 'g')), '');

  if char_length(v_title) < 1 or char_length(v_title) > 100 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if v_description is not null and char_length(v_description) > 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  begin
    v_category := p_category::public.question_category;
  exception
    when invalid_text_representation then
      return jsonb_build_object('ok', false, 'code', 'invalid');
  end;

  if not (
    (v_category = 'daily' and p_topic in ('routine', 'time', 'habit'))
    or (v_category = 'love' and p_topic in ('contact', 'boundary', 'date'))
    or (v_category = 'money' and p_topic in ('save', 'income', 'windfall'))
    or (v_category = 'work' and p_topic in ('task', 'people', 'pay'))
    or (v_category = 'food' and p_topic in ('menu', 'alone', 'together'))
    or (v_category = 'values' and p_topic in ('relation', 'help', 'rest'))
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  if jsonb_typeof(p_options) is distinct from 'array'
     or jsonb_array_length(p_options) < 2
     or jsonb_array_length(p_options) > 4 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  for opt in select value from jsonb_array_elements_text(p_options) as t(value)
  loop
    normalized := btrim(regexp_replace(opt, '\s+', ' ', 'g'));
    if char_length(normalized) < 1 or char_length(normalized) > 60 or normalized = any (seen) then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    seen := array_append(seen, normalized);
    cleaned := array_append(cleaned, normalized);
  end loop;

  if jsonb_typeof(coalesce(p_option_images, '[]'::jsonb)) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  image_count := jsonb_array_length(coalesce(p_option_images, '[]'::jsonb));
  if image_count > 0 and image_count <> array_length(cleaned, 1) then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  if image_count = 0 then
    for pos in 1..array_length(cleaned, 1)
    loop
      v_images := array_append(v_images, null);
    end loop;
  else
    for image_item in
      select case
        when jsonb_typeof(elem) = 'null' then null
        else nullif(btrim(elem #>> '{}'), '')
      end
      from jsonb_array_elements(coalesce(p_option_images, '[]'::jsonb)) as t(elem)
    loop
      if image_item is null then
        v_images := array_append(v_images, null);
      elsif char_length(image_item) < 8 or char_length(image_item) > 500
         or image_item !~* '^https?://' then
        return jsonb_build_object('ok', false, 'code', 'invalid');
      else
        v_images := array_append(v_images, image_item);
      end if;
    end loop;
  end if;

  if exists (
    select 1
    from public.questions q
    where q.status = 'published'
      and public.normalize_question_text(q.title) = public.normalize_question_text(v_title)
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_title');
  end if;

  if v_description is not null and exists (
    select 1
    from public.questions q
    where q.status = 'published'
      and q.description is not null
      and public.normalize_question_text(q.description) = public.normalize_question_text(v_description)
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_description');
  end if;

  if (
    select count(*)
    from public.questions q
    where q.created_by = auth.uid()
      and q.status <> 'hidden'
      and (q.created_at at time zone 'Asia/Seoul')::date = v_today
  ) >= 3 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  insert into public.questions (
    title, description, category, topic, status, published_at, created_by
  )
  values (
    v_title, v_description, v_category, p_topic, 'published', now(), auth.uid()
  )
  returning id into new_question;

  pos := 0;
  foreach opt in array cleaned
  loop
    insert into public.options (question_id, text, position, image_url)
    values (new_question, opt, pos, v_images[pos + 1]);
    pos := pos + 1;
  end loop;

  insert into public.question_suggestions (title, description, category, topic, options, user_id, status, reviewed_at)
  values (v_title, v_description, v_category, p_topic, to_jsonb(cleaned), auth.uid(), 'approved', now());

  return jsonb_build_object('ok', true, 'questionId', new_question);
end;
$$;

revoke all on function public.submit_suggestion(text, text, text, text, jsonb, jsonb) from public;
grant execute on function public.submit_suggestion(text, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.submit_suggestion(text, text, text, text, jsonb, jsonb) to anon;

notify pgrst, 'reload schema';
