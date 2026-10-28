import type { Metadata } from "next";
import { Suspense } from "react";

import { MyQuestionsView } from "@/components/my-questions-view";
import { loadMyQuestions } from "@/lib/data";

export const metadata: Metadata = {
  title: "내 질문",
  description: "내가 제안하거나 만든 질문을 확인합니다.",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 max-w-2xl rounded-3xl bg-card" />}>
      <Screen />
    </Suspense>
  );
}

async function Screen() {
  const data = await loadMyQuestions();
  return <MyQuestionsView mode={data.mode} initialItems={data.items} error={data.error} />;
}
