import type { Metadata } from "next";
import { Suspense } from "react";

import { SuggestForm } from "@/components/suggest-form";
import { SuggestGate } from "@/components/suggest-gate";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "질문 작성",
  description: "새로운 질문을 바로 공개합니다.",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="h-80 rounded-3xl bg-card" />}>
      <SuggestScreen />
    </Suspense>
  );
}

async function SuggestScreen() {
  const mode = isSupabaseConfigured() ? "live" : "demo";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold">질문 작성</h1>
        <p className="mt-3 leading-7 text-muted">
          주제와 세부 주제를 고른 뒤 질문과 선택지를 직접 작성해 주세요. 프로필을 설정한 뒤에는 질문이 바로 공개됩니다.
        </p>
      </header>
      <SuggestGate>
        {mode === "demo" ? (
          <p className="rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm leading-6 text-warn" role="status">
            데모 모드의 작성 내용은 이 브라우저에만 저장됩니다. 공유 데이터베이스로 전송되지 않습니다.
          </p>
        ) : null}
        <SuggestForm mode={mode} />
      </SuggestGate>
    </div>
  );
}
