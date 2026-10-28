"use client";

import type { ReactNode } from "react";

import { useProfile } from "@/components/profile-provider";

export function SuggestGate({ children }: { children: ReactNode }) {
  const { profile, loading, openSetup } = useProfile();

  if (loading) {
    return <div className="h-80 rounded-3xl bg-card" aria-hidden="true" />;
  }

  if (!profile?.nickname) {
    return (
      <div className="rounded-3xl border border-line bg-card px-5 py-8">
        <h2 className="text-xl font-bold">프로필이 필요합니다</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          닉네임을 정한 뒤에만 질문을 제안할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={openSetup}
          className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-accent px-4 text-sm font-semibold text-white"
        >
          프로필 설정하기
        </button>
      </div>
    );
  }

  return children;
}
