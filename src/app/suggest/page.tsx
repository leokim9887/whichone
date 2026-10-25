import type { Metadata } from "next";
import { Suspense } from "react";

import { SuggestForm } from "@/components/suggest-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "질문 제안",
  description: "새로운 질문을 제안합니다. 검토 후에만 공개됩니다.",
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
        <h1 className="text-3xl font-bold">질문 제안</h1>
        <p className="mt-3 leading-7 text-muted">
          주제를 고른 뒤 세부 갈래의 예시를 눌러 시작할 수 있습니다. 예시는 고쳐 써도 됩니다. 제안은 검토한 뒤에만 공개됩니다.
        </p>
      </header>
      {mode === "demo" ? (
        <p className="rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm leading-6 text-warn" role="status">
          데모 모드의 제안은 이 브라우저에만 저장됩니다. 공유 데이터베이스로 전송되지 않으며 공개되지도 않습니다.
        </p>
      ) : null}
      <SuggestForm mode={mode} />
    </div>
  );
}
