"use client";

import { ArrowRight } from "lucide-react";

import { SuggestEntryButton } from "@/components/suggest-entry-button";
import { useProfile } from "@/components/profile-provider";

export function SuggestCta() {
  const { profile, loading } = useProfile();

  if (loading || !profile?.nickname) {
    return null;
  }

  return (
    <section className="rounded-3xl bg-foreground px-5 py-6 text-card sm:px-8">
      <h2 className="text-2xl font-bold">이런 질문, 다른 사람들은 뭐라고 할까?</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-card/80">
        떠오른 질문을 작성해 주세요. 올리는 즉시 공개되어 누구나 투표할 수 있습니다. 질문 작성은 하루 최대 3개입니다.
      </p>
      <SuggestEntryButton className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-card px-4 text-sm font-semibold text-foreground disabled:opacity-60">
        질문 작성하기
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </SuggestEntryButton>
    </section>
  );
}
