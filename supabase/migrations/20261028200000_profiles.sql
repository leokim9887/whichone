-- 닉네임·프로필 사진 필수. 투표·댓글·답글·질문 제안 전에 설정합니다.
-- 기존 투표·댓글·질문은 지우지 않습니다.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  avatar_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_len check (char_length(btrim(nickname)) between 2 and 16),
  constraint profiles_avatar_url_len check (char_length(btrim(avatar_url)) between 8 and 500)
);

create unique index if not exists profiles_nickname_lower_uidx
  on public.profiles (lower(btrim(nickname)));

alter table public.profiles enable row level security;

drop policy if exists "Profiles are readable by everyone" on public.profiles;
create policy "Profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile"
  on public.profiles for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create or replace function public.has_complete_profile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and char_length(btrim(p.nickname)) >= 2
      and char_length(btrim(p.avatar_url)) >= 8
  );
$$;

create or replace function public.get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  select * into p from public.profiles where user_id = auth.uid();
  if not found then
    return jsonb_build_object('ok', true, 'profile', null);
  end if;

  return jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'nickname', p.nickname,
      'avatarUrl', p.avatar_url,
      'updatedAt', p.updated_at
    )
  );
end;
$$;

create or replace function public.upsert_my_profile(p_nickname text, p_avatar_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nick text;
  v_avatar text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  v_nick := btrim(coalesce(p_nickname, ''));
  v_avatar := btrim(coalesce(p_avatar_url, ''));

  if char_length(v_nick) < 2 or char_length(v_nick) > 16 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if v_nick !~ '^[가-힣a-zA-Z0-9_]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if char_length(v_avatar) < 8 or char_length(v_avatar) > 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if v_avatar !~* '^https?://' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  insert into public.profiles (user_id, nickname, avatar_url, updated_at)
  values (auth.uid(), v_nick, v_avatar, now())
  on conflict (user_id) do update set
    nickname = excluded.nickname,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'nickname', v_nick,
      'avatarUrl', v_avatar
    )
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'nickname_taken');
end;
$$;

create or replace function public.cast_vote(p_question_id uuid, p_option_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q_status public.question_status;
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

  if exists (
    select 1 from public.votes
    where question_id = p_question_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'code', 'already_voted');
  end if;

  insert into public.votes (question_id, option_id, user_id)
  values (p_question_id, p_option_id, auth.uid());

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'already_voted');
end;
$$;

create or replace function public.add_comment(p_question_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_option uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  if not public.has_complete_profile() then
    return jsonb_build_object('ok', false, 'code', 'profile_required');
  end if;

  v_body := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  if char_length(v_body) < 1 or char_length(v_body) > 300 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  if not exists (
    select 1 from public.questions
    where id = p_question_id and status = 'published'
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select option_id into v_option
  from public.votes
  where question_id = p_question_id and user_id = auth.uid();

  if v_option is null then
    return jsonb_build_object('ok', false, 'code', 'vote_required');
  end if;

  insert into public.comments (question_id, option_id, user_id, body, status, parent_id)
  values (p_question_id, v_option, auth.uid(), v_body, 'visible', null);

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.add_comment_reply(
  p_question_id uuid,
  p_parent_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_option uuid;
  v_parent_question uuid;
  v_parent_parent uuid;
  v_parent_status public.comment_status;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  if not public.has_complete_profile() then
    return jsonb_build_object('ok', false, 'code', 'profile_required');
  end if;

  v_body := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  if char_length(v_body) < 1 or char_length(v_body) > 300 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  select question_id, parent_id, status
    into v_parent_question, v_parent_parent, v_parent_status
  from public.comments
  where id = p_parent_id;

  if v_parent_question is null
     or v_parent_question is distinct from p_question_id
     or v_parent_parent is not null
     or v_parent_status is distinct from 'visible' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if not exists (
    select 1 from public.questions
    where id = p_question_id and status = 'published'
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select option_id into v_option
  from public.votes
  where question_id = p_question_id and user_id = auth.uid();

  if v_option is null then
    return jsonb_build_object('ok', false, 'code', 'vote_required');
  end if;

  insert into public.comments (question_id, option_id, user_id, body, status, parent_id)
  values (p_question_id, v_option, auth.uid(), v_body, 'visible', p_parent_id);

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.submit_suggestion(
  p_title text,
  p_description text,
  p_category text,
  p_topic text,
  p_options jsonb
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

  if (
    select count(*)
    from public.question_suggestions
    where user_id = auth.uid()
      and created_at > now() - interval '1 day'
  ) >= 5 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  insert into public.question_suggestions (title, description, category, topic, options, user_id, status)
  values (v_title, v_description, v_category, p_topic, to_jsonb(cleaned), auth.uid(), 'pending');

  return jsonb_build_object('ok', true);
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
        'authorNickname', (
          select p.nickname from public.profiles p where p.user_id = q.created_by
        ),
        'authorAvatarUrl', (
          select p.avatar_url from public.profiles p where p.user_id = q.created_by
        ),
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
      'authorNickname', (
        select p.nickname from public.profiles p where p.user_id = q.created_by
      ),
      'authorAvatarUrl', (
        select p.avatar_url from public.profiles p where p.user_id = q.created_by
      ),
      'options', opts
    )
  );
end;
$$;

create or replace function public.list_visible_comments(p_question_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.questions
    where id = p_question_id and status = 'published'
  ) then
    return '[]'::jsonb;
  end if;

  if not public.is_admin() and not exists (
    select 1 from public.votes
    where question_id = p_question_id and user_id = auth.uid()
  ) then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(roots.item order by roots.created_at desc)
      from (
        select
          c.created_at,
          jsonb_build_object(
            'id', c.id,
            'optionId', c.option_id,
            'body', c.body,
            'createdAt', c.created_at,
            'nickname', coalesce((
              select p.nickname from public.profiles p where p.user_id = c.user_id
            ), '익명'),
            'avatarUrl', (
              select p.avatar_url from public.profiles p where p.user_id = c.user_id
            ),
            'likeCount', (
              select count(*)::int from public.comment_likes l where l.comment_id = c.id
            ),
            'likedByMe', exists (
              select 1 from public.comment_likes l
              where l.comment_id = c.id and l.user_id = auth.uid()
            ),
            'mine', (c.user_id = auth.uid()) is true,
            'replies', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', r.id,
                  'optionId', r.option_id,
                  'body', r.body,
                  'createdAt', r.created_at,
                  'nickname', coalesce((
                    select p.nickname from public.profiles p where p.user_id = r.user_id
                  ), '익명'),
                  'avatarUrl', (
                    select p.avatar_url from public.profiles p where p.user_id = r.user_id
                  ),
                  'likeCount', (
                    select count(*)::int from public.comment_likes l where l.comment_id = r.id
                  ),
                  'likedByMe', exists (
                    select 1 from public.comment_likes l
                    where l.comment_id = r.id and l.user_id = auth.uid()
                  ),
                  'mine', (r.user_id = auth.uid()) is true
                )
                order by r.created_at asc
              )
              from public.comments r
              where r.parent_id = c.id
                and r.status = 'visible'
            ), '[]'::jsonb)
          ) as item
        from public.comments c
        where c.question_id = p_question_id
          and c.status = 'visible'
          and c.parent_id is null
        order by c.created_at desc
        limit 100
      ) roots
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.has_complete_profile() from public;
revoke all on function public.get_my_profile() from public;
revoke all on function public.upsert_my_profile(text, text) from public;

grant execute on function public.has_complete_profile() to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.upsert_my_profile(text, text) to authenticated;

notify pgrst, 'reload schema';
