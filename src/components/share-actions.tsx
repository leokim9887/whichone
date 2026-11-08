"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

export function ShareActions({ title, description }: { title: string; description: string | null }) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setFeedback("링크를 복사했습니다.");
    } catch {
      setFeedback("링크를 복사하지 못했습니다. 주소창에서 직접 복사해 주세요.");
    }
  }

  async function share() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title,
          text: description ?? "다른 사람들은 어떻게 생각할까?",
          url,
        });
        setFeedback("공유 창을 열었습니다.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }
    await copyLink();
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        onClick={() => void share()}
        className="pressable inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-card px-4 text-sm font-semibold hover:border-foreground/25 sm:w-auto"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        공유하기
      </button>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="pressable inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-card px-4 text-sm font-semibold hover:border-foreground/25 sm:w-auto"
      >
        {feedback === "링크를 복사했습니다." ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
        링크 복사
      </button>
      {feedback ? (
        <p className="fade-in text-sm text-muted" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
