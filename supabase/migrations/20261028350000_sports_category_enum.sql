-- 스포츠 카테고리 enum 추가 (같은 트랜잭션에서 바로 쓰면 안 되므로 분리)

alter type public.question_category add value if not exists 'sports';
