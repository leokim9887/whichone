-- 한 사람이 같은 질문에 의견을 여러 번 남길 수 있게 합니다.
-- 기존 의견, 답글, 추천, 투표 행은 지우지 않습니다.

drop index if exists public.comments_one_visible_root_per_user;
drop index if exists public.comments_one_root_per_user;

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

  insert into public.comments (question_id, option_id, user_id, body, status, parent_id)
  values (p_question_id, v_option, auth.uid(), v_body, 'visible', null);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.add_comment(uuid, text) from public;
grant execute on function public.add_comment(uuid, text) to authenticated;

notify pgrst, 'reload schema';
