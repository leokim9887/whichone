-- WhicHOne: 스포츠 카테고리 1단계 (enum)
-- Supabase SQL Editor에서 이 파일을 Run 한 뒤,
-- scripts/fix-sports-category-2-submit.sql 을 이어서 Run 하세요.

alter type public.question_category add value if not exists 'sports';
