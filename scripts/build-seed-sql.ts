import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SEED_QUESTIONS } from "../src/lib/seed-questions.ts";

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const lines: string[] = [
  "-- 예시 질문만 넣습니다. 투표 기록은 넣지 않습니다.",
  "-- src/lib/seed-questions.ts와 같은 질문입니다.",
  "-- SQL Editor에서 이 파일 전체를 한 번에 실행하세요. 선택지 개수 검사는 트랜잭션이 끝날 때 동작합니다.",
  "begin;",
];

for (const question of SEED_QUESTIONS) {
  lines.push(
    `insert into public.questions (id, title, description, category, topic, status, created_at, published_at, daily_feature_date) values (${sqlString(question.id)}, ${sqlString(question.title)}, ${question.description ? sqlString(question.description) : "null"}, ${sqlString(question.category)}::public.question_category, ${question.topic ? sqlString(question.topic) : "null"}, 'published', ${sqlString(question.createdAt)}::timestamptz, ${sqlString(question.publishedAt)}::timestamptz, null);`,
  );
  for (const option of question.options) {
    lines.push(
      `insert into public.options (id, question_id, text, position) values (${sqlString(option.id)}, ${sqlString(question.id)}, ${sqlString(option.text)}, ${option.position});`,
    );
  }
}

lines.push("commit;");
lines.push("");

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../supabase/seed.sql");
writeFileSync(target, lines.join("\n"), "utf8");
console.log(`wrote ${target}`);
