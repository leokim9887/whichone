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
    <section className="accent-sheen relative overflow-hidden rounded-[1.75rem] px-5 py-6 text-white shadow-[0_18px_40px_rgba(47,75,255,0.22)] sm:px-8 sm:py-7">
      <div
        className="pointer-events-none absolute -right-6 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative">
        <h2 className="text-xl font-bold leading-snug sm:text-2xl">이런 질문, 다른 사람들은 뭐라고 할까?</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">
          떠오른 질문을 바로 올려 보세요. 올리는 순간 공개되고, 하루 최대 3개까지 작성할 수 있어요.
        </p>
        <SuggestEntryButton className="pressable mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-foreground shadow-[0_10px_24px_rgba(28,25,23,0.12)] disabled:opacity-60 sm:w-auto sm:justify-start">
          질문 작성하기
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </SuggestEntryButton>
      </div>
    </section>
  );
}
