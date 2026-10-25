-- 의견에 답글 한 단계와 추천을 추가합니다.
-- 기존 의견, 투표, 신고 행은 지우지 않습니다.
-- 질문당 의견은 여전히 한 개이고, 답글은 의견마다 한 개입니다.

alter table public.comments
  add column if not exists parent_id uuid references public.comments (id) on delete cascade;

create unique index if not exists comments_one_root_per_user
  on public.comments (question_id, user_id)
  where parent_id is null;

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.comments'::regclass
    and con.contype = 'u'
    and pg_get_constraintdef(con.oid) ilike '%question_id%'
    and pg_get_constraintdef(con.oid) ilike '%user_id%';
  if cname is not null then
    execute format('alter table public.comments drop constraint %I', cname);
  end if;
end $$;

create unique index if not exists comments_one_reply_per_user
  on public.comments (parent_id, user_id)
  where parent_id is not null;

create index if not exists comments_parent_created_idx
  on public.comments (parent_id, created_at)
  where parent_id is not null;

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_likes_comment_idx on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;
revoke all on table public.comment_likes from anon, authenticated, public;

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

  if new.parent_id is not null then
    if not exists (
      select 1
      from public.comments parent
      where parent.id = new.parent_id
        and parent.question_id = new.question_id
        and parent.parent_id is null
        and parent.status = 'visible'
    ) then
      raise exception 'parent_invalid' using errcode = '23514';
    end if;
  end if;

  return new;
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
      and c.parent_id is null
      and c.status <> 'deleted'
    order by c.created_at
    limit 1;
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
      select jsonb_agg(roots.item order by roots.created_at desc)
      from (
        select
          c.created_at,
          jsonb_build_object(
            'id', c.id,
            'optionId', c.option_id,
            'body', c.body,
            'createdAt', c.created_at,
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
    where question_id = p_question_id
      and user_id = auth.uid()
      and parent_id is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'already_commented');
  end if;

  insert into public.comments (question_id, option_id, user_id, body, status, parent_id)
  values (p_question_id, v_option, auth.uid(), v_body, 'visible', null);

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'already_commented');
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

  if exists (
    select 1 from public.comments
    where parent_id = p_parent_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'code', 'already_replied');
  end if;

  insert into public.comments (question_id, option_id, user_id, body, status, parent_id)
  values (p_question_id, v_option, auth.uid(), v_body, 'visible', p_parent_id);

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'already_replied');
end;
$$;

create or replace function public.toggle_comment_like(
  p_question_id uuid,
  p_comment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status public.comment_status;
  v_question uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  select user_id, status, question_id
    into v_owner, v_status, v_question
  from public.comments
  where id = p_comment_id;

  if v_owner is null
     or v_question is distinct from p_question_id
     or v_status is distinct from 'visible' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if not exists (
    select 1 from public.questions
    where id = p_question_id and status = 'published'
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if not exists (
    select 1 from public.votes
    where question_id = p_question_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'code', 'vote_required');
  end if;

  if v_owner = auth.uid() then
    return jsonb_build_object('ok', false, 'code', 'own_like');
  end if;

  delete from public.comment_likes
  where comment_id = p_comment_id and user_id = auth.uid();

  if found then
    return jsonb_build_object('ok', true);
  end if;

  insert into public.comment_likes (comment_id, user_id)
  values (p_comment_id, auth.uid());

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.enforce_comment_integrity() from public;
revoke all on function public.get_my_participation(uuid) from public;
revoke all on function public.list_visible_comments(uuid) from public;
revoke all on function public.add_comment(uuid, text) from public;
revoke all on function public.add_comment_reply(uuid, uuid, text) from public;
revoke all on function public.toggle_comment_like(uuid, uuid) from public;

grant execute on function public.enforce_comment_integrity() to authenticated;
grant execute on function public.get_my_participation(uuid) to anon, authenticated;
grant execute on function public.list_visible_comments(uuid) to anon, authenticated;
grant execute on function public.add_comment(uuid, text) to authenticated;
grant execute on function public.add_comment_reply(uuid, uuid, text) to authenticated;
grant execute on function public.toggle_comment_like(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
