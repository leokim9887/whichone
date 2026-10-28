-- 프로필 사진은 선택 사항. 닉네임만 필수이며 중복은 차단합니다.
-- 기존 프로필·투표·댓글 행은 지우지 않습니다.

alter table public.profiles
  alter column avatar_url drop not null;

alter table public.profiles
  drop constraint if exists profiles_avatar_url_len;

alter table public.profiles
  add constraint profiles_avatar_url_len check (
    avatar_url is null
    or (
      char_length(btrim(avatar_url)) between 8 and 500
      and avatar_url ~* '^https?://'
    )
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
  );
$$;

create or replace function public.is_nickname_available(p_nickname text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_nick text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'auth_required');
  end if;

  v_nick := btrim(coalesce(p_nickname, ''));
  if char_length(v_nick) < 2 or char_length(v_nick) > 16 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if v_nick !~ '^[가-힣a-zA-Z0-9_]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  if exists (
    select 1
    from public.profiles p
    where lower(btrim(p.nickname)) = lower(v_nick)
      and p.user_id is distinct from auth.uid()
  ) then
    return jsonb_build_object('ok', true, 'available', false);
  end if;

  return jsonb_build_object('ok', true, 'available', true);
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
  v_avatar := nullif(btrim(coalesce(p_avatar_url, '')), '');

  if char_length(v_nick) < 2 or char_length(v_nick) > 16 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if v_nick !~ '^[가-힣a-zA-Z0-9_]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  if exists (
    select 1
    from public.profiles p
    where lower(btrim(p.nickname)) = lower(v_nick)
      and p.user_id is distinct from auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'code', 'nickname_taken');
  end if;

  if v_avatar is not null then
    if char_length(v_avatar) < 8 or char_length(v_avatar) > 500 then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    if v_avatar !~* '^https?://' then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
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

revoke all on function public.is_nickname_available(text) from public;
grant execute on function public.is_nickname_available(text) to authenticated;

notify pgrst, 'reload schema';
