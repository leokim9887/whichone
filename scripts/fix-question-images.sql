-- 질문 사진(최대 3장) + 제목/설명 중복 검사

alter table public.questions
  add column if not exists image_urls text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_image_urls_len'
      and conrelid = 'public.questions'::regclass
  ) then
    alter table public.questions
      add constraint questions_image_urls_len
      check (cardinality(image_urls) <= 3);
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-images',
  'question-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Question images are publicly accessible" on storage.objects;
create policy "Question images are publicly accessible"
on storage.objects for select
using (bucket_id = 'question-images');

drop policy if exists "Users can upload their own question images" on storage.objects;
create policy "Users can upload their own question images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own question images" on storage.objects;
create policy "Users can update their own question images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own question images" on storage.objects;
create policy "Users can delete their own question images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.normalize_question_text(p_value text)
returns text
language sql
immutable
as $$
  select lower(btrim(regexp_replace(coalesce(p_value, ''), '\s+', ' ', 'g')));
$$;

create or replace function public.check_question_duplicate(
  p_title text,
  p_description text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_title text := public.normalize_question_text(p_title);
  v_description text := nullif(public.normalize_question_text(p_description), '');
  v_title_taken boolean := false;
  v_description_taken boolean := false;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  if char_length(v_title) > 0 then
    select exists (
      select 1
      from public.questions q
      where q.status = 'published'
        and public.normalize_question_text(q.title) = v_title
    ) into v_title_taken;
  end if;

  if v_description is not null then
    select exists (
      select 1
      from public.questions q
      where q.status = 'published'
        and q.description is not null
        and public.normalize_question_text(q.description) = v_description
    ) into v_description_taken;
  end if;

  return jsonb_build_object(
    'ok', true,
    'titleTaken', v_title_taken,
    'descriptionTaken', v_description_taken
  );
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
        'imageUrls', to_jsonb(coalesce(q.image_urls, '{}'::text[])),
        'options', '[]'::jsonb
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
      jsonb_build_object('id', o.id, 'text', o.text, 'position', o.position)
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
      'imageUrls', to_jsonb(coalesce(q.image_urls, '{}'::text[])),
      'options', opts
    )
  );
end;
$$;

drop function if exists public.submit_suggestion(text, text, text, text, jsonb);

create or replace function public.submit_suggestion(
  p_title text,
  p_description text,
  p_category text,
  p_topic text,
  p_options jsonb,
  p_image_urls jsonb default '[]'::jsonb
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

  if jsonb_typeof(coalesce(p_image_urls, '[]'::jsonb)) is distinct from 'array'
     or jsonb_array_length(coalesce(p_image_urls, '[]'::jsonb)) > 3 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  for image_item in select value from jsonb_array_elements_text(coalesce(p_image_urls, '[]'::jsonb)) as t(value)
  loop
    if char_length(image_item) < 8 or char_length(image_item) > 500
       or image_item !~* '^https?://' then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    v_images := array_append(v_images, image_item);
  end loop;

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
    title, description, category, topic, status, published_at, created_by, image_urls
  )
  values (
    v_title, v_description, v_category, p_topic, 'published', now(), auth.uid(), v_images
  )
  returning id into new_question;

  foreach opt in array cleaned
  loop
    insert into public.options (question_id, text, position)
    values (new_question, opt, pos);
    pos := pos + 1;
  end loop;

  insert into public.question_suggestions (title, description, category, topic, options, user_id, status, reviewed_at)
  values (v_title, v_description, v_category, p_topic, to_jsonb(cleaned), auth.uid(), 'approved', now());

  return jsonb_build_object('ok', true, 'questionId', new_question);
end;
$$;

revoke all on function public.check_question_duplicate(text, text) from public;
grant execute on function public.check_question_duplicate(text, text) to authenticated;
grant execute on function public.check_question_duplicate(text, text) to anon;

revoke all on function public.submit_suggestion(text, text, text, text, jsonb, jsonb) from public;
grant execute on function public.submit_suggestion(text, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.submit_suggestion(text, text, text, text, jsonb, jsonb) to anon;

notify pgrst, 'reload schema';
