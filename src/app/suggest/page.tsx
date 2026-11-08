import type { Metadata } from "next";
import { Suspense } from "react";

import { SuggestForm } from "@/components/suggest-form";
import { SuggestGate } from "@/components/suggest-gate";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "질문 작성",
  description: "새로운 질문을 작성하고 바로 공개합니다.",
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
      <header className="space-y-2">
        <p className="text-sm font-semibold text-accent">새 질문</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">궁금한 걸 물어보세요</h1>
        <p className="max-w-xl text-sm leading-7 text-muted sm:text-base">
          제목과 선택지만 있으면 충분해요. 사진이나 짧은 설명을 더하면 사람들이 더 쉽게 고를 수 있습니다.
        </p>
      </header>
      <SuggestGate>
        {mode === "demo" ? (
          <p className="rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm leading-6 text-warn" role="status">
            데모 모드에서는 작성 내용이 이 브라우저에만 저장됩니다.
          </p>
        ) : null}
        <SuggestForm mode={mode} />
      </SuggestGate>
    </div>
  );
}
