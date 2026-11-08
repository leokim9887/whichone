import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { SuggestForm } from "@/components/suggest-form";
import { SuggestGate } from "@/components/suggest-gate";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "질문 작성",
  description: "새로운 질문을 작성하고 바로 공개합니다.",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="h-80 rounded-[1.75rem] bg-card" />}>
      <SuggestScreen />
    </Suspense>
  );
}

async function SuggestScreen() {
  const mode = isSupabaseConfigured() ? "live" : "demo";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="새 질문"
        title="궁금한 걸 물어보세요"
        description="제목과 선택지만 있으면 충분해요. 선택지에 사진을 넣으면 고르기가 더 직관적입니다."
      />
      <SuggestGate>
        {mode === "demo" ? (
          <p className="rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm leading-6 text-warn" role="status">
            데모 모드에서는 작성 내용이 이 브라우저에만 저장됩니다.
          </p>
        ) : null}
        <div className="rise-in" style={{ animationDelay: "80ms" }}>
          <SuggestForm mode={mode} />
        </div>
      </SuggestGate>
    </div>
  );
}
