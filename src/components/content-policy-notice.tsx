"use client";

import { useSyncExternalStore } from "react";

import {
  readContentPolicyVisible,
  subscribeContentPolicyVisible,
  writeContentPolicyVisible,
} from "@/lib/content-policy-storage";

export function ContentPolicyNotice() {
  const visible = useSyncExternalStore(
    subscribeContentPolicyVisible,
    readContentPolicyVisible,
    () => true,
  );

  if (!visible) {
    return (
      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => writeContentPolicyVisible(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-[#f0d7a8] bg-[#fff8ee] px-3.5 text-sm font-semibold text-[#7a4e00] transition hover:bg-[#fff1d6]"
        >
          <WarnIcon className="h-4 w-4 shrink-0" />
          콘텐츠 이용 안내 보기
        </button>
      </div>
    );
  }

  return (
    <aside
      className="content-policy-notice relative overflow-hidden rounded-2xl border border-[#f0d7a8] bg-[#fff8ee] px-4 py-3 sm:px-5"
      role="note"
      aria-label="콘텐츠 이용 안내"
    >
      <span className="content-policy-glow" aria-hidden="true" />
      <div className="relative flex gap-3">
        <span
          className="content-policy-icon mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#efd2a0] bg-[#fff1d6] text-[#9a6700]"
          aria-hidden="true"
        >
          <WarnIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 pr-8">
          <p className="text-sm font-semibold text-[#7a4e00]">콘텐츠 이용 안내</p>
          <p className="mt-1 text-sm leading-6 text-[#8a5a14]">
            지나치게 정치적이거나 선정·폭력적인 주제와 표현은 검토 후 비공개되거나 삭제될 수 있습니다. 서로 존중하는
            질문과 의견을 남겨 주세요.
          </p>
          <p className="mt-2 text-sm leading-6 text-[#8a5a14]">
            질문 작성은 프로필당 하루 최대 <span className="font-semibold">3개</span>입니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => writeContentPolicyVisible(false)}
          className="absolute right-2.5 top-2.5 inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#9a6700] transition hover:bg-[#ffe8bf]"
          aria-label="콘텐츠 이용 안내 숨기기"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6 6 18" strokeLinecap="round" />
            <path d="m6 6 12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

function WarnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 9v4" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
      <path
        d="M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
