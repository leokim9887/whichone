-- WhicHOne MVP schema
-- 빈 Supabase 프로젝트의 SQL Editor에서 이 파일을 한 번 실행합니다.
-- 서비스 롤 키는 사용하지 않습니다. 관리자는 admin_users에 사용자 UUID를 넣는 방식으로만 지정합니다.
--
-- 보안 모델:
-- 1) 테이블은 RLS를 켜고, anon/authenticated의 직접 권한은 거둡니다.
-- 2) 앱은 security definer 함수로만 읽고 씁니다.
-- 3) 함수 소유자는 RLS를 우회할 수 있으므로, 모든 변경 함수가 auth.uid()와 is_admin()을 직접 확인합니다.

create extension if not exists pgcrypto;

do $$
begin
  create type public.question_category as enum ('daily', 'love', 'money', 'work', 'food', 'values');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.question_status as enum ('draft', 'published', 'hidden');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.suggestion_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.comment_status as enum ('visible', 'hidden', 'deleted');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.report_target as enum ('question', 'comment');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.report_status as enum ('open', 'reviewed', 'dismissed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text check (description is null or char_length(description) between 1 and 500),
  category public.question_category not null,
  topic text,
  status public.question_status not null default 'draft',
  created_at timestamptz not null default now(),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  daily_feature_date date,
  constraint published_has_date check (status <> 'published' or published_at is not null)
);

create table if not exists public.options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 60),
  position integer not null check (position between 0 and 3),
  unique (question_id, position),
  unique (question_id, text)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  option_id uuid not null references public.options (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  option_id uuid not null references public.options (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  status public.comment_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create table if not exists public.question_suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text check (description is null or char_length(description) between 1 and 500),
  category public.question_category not null,
  topic text,
  options jsonb not null,
  user_id uuid references auth.users (id) on delete set null,
  status public.suggestion_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint suggestion_options_shape check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 4
  )
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type public.report_target not null,
  target_id uuid not null,
  reporter_user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 300),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  unique (target_type, target_id, reporter_user_id)
);

create index if not exists votes_question_id_idx on public.votes (question_id);
create index if not exists votes_option_id_idx on public.votes (option_id);
create index if not exists comments_question_created_idx on public.comments (question_id, created_at desc);
create index if not exists questions_published_idx on public.questions (status, published_at desc);
create unique index if not exists questions_daily_feature_idx
  on public.questions (daily_feature_date)
  where daily_feature_date is not null;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists comments_touch on public.comments;
create trigger comments_touch
before update on public.comments
for each row execute function public.touch_updated_at();

create or replace function public.enforce_vote_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q_status public.question_status;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'user_mismatch' using errcode = '42501';
  end if;

  select status into q_status from public.questions where id = new.question_id;
  if q_status is distinct from 'published' then
    raise exception 'not_published' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.options
    where id = new.option_id
      and question_id = new.question_id
  ) then
    raise exception 'option_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists votes_integrity on public.votes;
create trigger votes_integrity
before insert on public.votes
for each row execute function public.enforce_vote_integrity();

create or replace function public.enforce_comment_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  voted_option uuid;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'user_mismatch' using errcode = '42501';
  end if;

  if new.status is distinct from 'visible' then
    raise exception 'status_locked' using errcode = '42501';
  end if;

  select option_id into voted_option
  from public.votes
  where question_id = new.question_id
    and user_id = new.user_id;

  if voted_option is null then
    raise exception 'vote_required' using errcode = '42501';
  end if;

  if new.option_id is distinct from voted_option then
    raise exception 'option_mismatch' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.questions
    where id = new.question_id and status = 'published'
  ) then
    raise exception 'not_published' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_integrity on public.comments;
create trigger comments_integrity
before insert on public.comments
for each row execute function public.enforce_comment_integrity();

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
  select count(*) into cnt from public.options where question_id = qid;
  if cnt < 2 or cnt > 4 then
    raise exception 'option_count' using errcode = '23514';
  end if;
  return null;
end;
$$;

drop trigger if exists options_count_check on public.options;
create constraint trigger options_count_check
after insert or update or delete on public.options
deferrable initially deferred
for each row execute function public.enforce_option_count();

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
      'options', opts
    )
  );
end;
$$;

create or replace function public.get_my_participation(p_question_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q_status public.question_status;
  v_total bigint;
  v_option uuid;
  v_voted boolean := false;
  v_counts jsonb;
  v_comment jsonb;
begin
  select status into q_status from public.questions where id = p_question_id;
  if q_status is null then
    return jsonb_build_object('state', 'missing');
  end if;
  if q_status <> 'published' then
    return jsonb_build_object('state', 'unpublished');
  end if;

  select count(*) into v_total from public.votes where question_id = p_question_id;

  if auth.uid() is not null then
    select option_id into v_option
    from public.votes
    where question_id = p_question_id
      and user_id = auth.uid();
    v_voted := v_option is not null;

    select jsonb_build_object(
      'id', c.id,
      'optionId', c.option_id,
      'body', c.body,
      'createdAt', c.created_at,
      'status', c.status
    )
    into v_comment
    from public.comments c
    where c.question_id = p_question_id
      and c.user_id = auth.uid()
      and c.status <> 'deleted';
  end if;

  if v_voted or public.is_admin() then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'optionId', o.id,
          'voteCount', coalesce(c.cnt, 0)
        )
        order by o.position
      ),
      '[]'::jsonb
    )
    into v_counts
    from public.options o
    left join (
      select option_id, count(*) as cnt
      from public.votes
      where question_id = p_question_id
      group by option_id
    ) c on c.option_id = o.id
    where o.question_id = p_question_id;
  end if;

  return jsonb_build_object(
    'state', 'ok',
    'participantCount', v_total,
    'voted', v_voted,
    'optionId', v_option,
    'comment', v_comment,
    'counts', v_counts
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
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'optionId', c.option_id,
          'body', c.body,
          'createdAt', c.created_at
        )
        order by c.created_at desc
      )
      from (
        select id, option_id, body, created_at
        from public.comments
        where question_id = p_question_id
          and status = 'visible'
        order by created_at desc
        limit 100
      ) c
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.my_voted_question_ids()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then '[]'::jsonb
    else coalesce(
      (select jsonb_agg(question_id) from public.votes where user_id = auth.uid()),
      '[]'::jsonb
    )
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

  if exists (
    select 1 from public.comments
    where question_id = p_question_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'code', 'already_commented');
  end if;

  insert into public.comments (question_id, option_id, user_id, body, status)
  values (p_question_id, v_option, auth.uid(), v_body, 'visible');

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'already_commented');
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

  v_title := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
  v_description := nullif(btrim(regexp_replace(coalesce(p_description, ''), '\s+', ' ', 'g')), '');

  if char_length(v_title) < 1 or char_length(v_title) > 100 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if v_description is not null and char_length(v_description) > 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

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

  begin
    v_category := p_category::public.question_category;
  exception
    when invalid_text_representation then
      return jsonb_build_object('ok', false, 'code', 'invalid');
  end;

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

create or replace function public.submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.report_target;
  v_reason text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  begin
    v_type := p_target_type::public.report_target;
  exception
    when invalid_text_representation then
      return jsonb_build_object('ok', false, 'code', 'invalid');
  end;

  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 1 or char_length(v_reason) > 300 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  if v_type = 'question' then
    if not exists (
      select 1 from public.questions
      where id = p_target_id and status = 'published'
    ) then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;
  else
    if not exists (
      select 1
      from public.comments c
      join public.questions q on q.id = c.question_id
      where c.id = p_target_id
        and c.status = 'visible'
        and q.status = 'published'
    ) then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;
  end if;

  insert into public.reports (target_type, target_id, reporter_user_id, reason, status)
  values (v_type, p_target_id, auth.uid(), v_reason, 'open');

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'already_reported');
end;
$$;

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

create or replace function public.admin_review_suggestion(p_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.question_suggestions%rowtype;
  new_question uuid;
  opt text;
  pos integer := 0;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  select * into s from public.question_suggestions where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if s.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'already_reviewed');
  end if;

  if p_decision = 'rejected' then
    update public.question_suggestions
    set status = 'rejected', reviewed_at = now()
    where id = p_id;
    return jsonb_build_object('ok', true);
  end if;

  insert into public.questions (title, description, category, topic, status, published_at, created_by)
  values (s.title, s.description, s.category, s.topic, 'published', now(), s.user_id)
  returning id into new_question;

  for opt in select value from jsonb_array_elements_text(s.options) as t(value)
  loop
    insert into public.options (question_id, text, position)
    values (new_question, opt, pos);
    pos := pos + 1;
  end loop;

  update public.question_suggestions
  set status = 'approved', reviewed_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'questionId', new_question);
end;
$$;

create or replace function public.admin_set_question_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.question_status;
  cnt integer;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  begin
    v_status := p_status::public.question_status;
  exception
    when invalid_text_representation then
      return jsonb_build_object('ok', false, 'code', 'invalid');
  end;

  if not exists (select 1 from public.questions where id = p_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_status = 'published' then
    select count(*) into cnt from public.options where question_id = p_id;
    if cnt < 2 or cnt > 4 then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    update public.questions
    set status = 'published',
        published_at = coalesce(published_at, now())
    where id = p_id;
  else
    update public.questions
    set status = v_status
    where id = p_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_resolve_report(p_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reports%rowtype;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_action not in ('dismiss', 'hide', 'remove') then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  select * into r from public.reports where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if r.status <> 'open' then
    return jsonb_build_object('ok', false, 'code', 'already_reviewed');
  end if;

  if p_action = 'dismiss' then
    update public.reports set status = 'dismissed' where id = p_id;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'remove' and r.target_type <> 'comment' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  if r.target_type = 'comment' then
    update public.comments
    set status = case when p_action = 'remove' then 'deleted'::public.comment_status else 'hidden'::public.comment_status end
    where id = r.target_id;
  else
    update public.questions
    set status = 'hidden'
    where id = r.target_id;
  end if;

  update public.reports set status = 'reviewed' where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

alter table public.admin_users enable row level security;
alter table public.questions enable row level security;
alter table public.options enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.question_suggestions enable row level security;
alter table public.reports enable row level security;

drop policy if exists questions_public_read on public.questions;
create policy questions_public_read on public.questions
for select to anon, authenticated
using (status = 'published' or public.is_admin());

drop policy if exists options_public_read on public.options;
create policy options_public_read on public.options
for select to anon, authenticated
using (
  exists (
    select 1 from public.questions q
    where q.id = options.question_id
      and (q.status = 'published' or public.is_admin())
  )
);

drop policy if exists votes_insert_own on public.votes;
create policy votes_insert_own on public.votes
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists votes_select_own on public.votes;
create policy votes_select_own on public.votes
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments
for insert to authenticated
with check (user_id = auth.uid() and status = 'visible');

drop policy if exists comments_admin_read on public.comments;
create policy comments_admin_read on public.comments
for select to authenticated
using (public.is_admin());

drop policy if exists suggestions_insert_own on public.question_suggestions;
create policy suggestions_insert_own on public.question_suggestions
for insert to authenticated
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists suggestions_select_own on public.question_suggestions;
create policy suggestions_select_own on public.question_suggestions
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
for insert to authenticated
with check (reporter_user_id = auth.uid() and status = 'open');

drop policy if exists reports_admin_read on public.reports;
create policy reports_admin_read on public.reports
for select to authenticated
using (public.is_admin());

revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.questions from anon, authenticated;
revoke all on table public.options from anon, authenticated;
revoke all on table public.votes from anon, authenticated;
revoke all on table public.comments from anon, authenticated;
revoke all on table public.question_suggestions from anon, authenticated;
revoke all on table public.reports from anon, authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.touch_updated_at() from public;
revoke all on function public.enforce_vote_integrity() from public;
revoke all on function public.enforce_comment_integrity() from public;
revoke all on function public.enforce_option_count() from public;

grant execute on function public.touch_updated_at() to authenticated;
grant execute on function public.enforce_vote_integrity() to authenticated;
grant execute on function public.enforce_comment_integrity() to authenticated;
grant execute on function public.enforce_option_count() to authenticated;
revoke all on function public.list_published_questions() from public;
revoke all on function public.get_published_question(uuid) from public;
revoke all on function public.get_my_participation(uuid) from public;
revoke all on function public.list_visible_comments(uuid) from public;
revoke all on function public.my_voted_question_ids() from public;
revoke all on function public.cast_vote(uuid, uuid) from public;
revoke all on function public.add_comment(uuid, text) from public;
revoke all on function public.submit_suggestion(text, text, text, text, jsonb) from public;
revoke all on function public.submit_report(text, uuid, text) from public;
revoke all on function public.admin_dashboard() from public;
revoke all on function public.admin_review_suggestion(uuid, text) from public;
revoke all on function public.admin_set_question_status(uuid, text) from public;
revoke all on function public.admin_set_daily_feature(uuid, text) from public;
revoke all on function public.admin_resolve_report(uuid, text) from public;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.list_published_questions() to anon, authenticated;
grant execute on function public.get_published_question(uuid) to anon, authenticated;
grant execute on function public.get_my_participation(uuid) to anon, authenticated;
grant execute on function public.list_visible_comments(uuid) to anon, authenticated;
grant execute on function public.my_voted_question_ids() to anon, authenticated;
grant execute on function public.cast_vote(uuid, uuid) to authenticated;
grant execute on function public.add_comment(uuid, text) to authenticated;
grant execute on function public.submit_suggestion(text, text, text, text, jsonb) to authenticated;
grant execute on function public.submit_report(text, uuid, text) to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_review_suggestion(uuid, text) to authenticated;
grant execute on function public.admin_set_question_status(uuid, text) to authenticated;
grant execute on function public.admin_set_daily_feature(uuid, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;

notify pgrst, 'reload schema';
