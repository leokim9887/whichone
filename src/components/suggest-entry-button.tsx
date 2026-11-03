"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { messageForCode } from "@/lib/messages";
import { canWriteQuestionToday, getCachedWriteAllowed } from "@/lib/suggest-quota";

export function SuggestEntryButton({
  className,
  children,
  onBeforeNavigate,
  role,
}: {
  className?: string;
  children: ReactNode;
  onBeforeNavigate?: () => void;
  role?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function openSuggest() {
    if (pending) {
      return;
    }

    const cached = getCachedWriteAllowed();
    if (cached === false) {
      window.alert(messageForCode("rate_limited"));
      return;
    }

    if (cached === true) {
      onBeforeNavigate?.();
      router.push("/suggest");
      // 백그라운드로 최신 한도 갱신
      void canWriteQuestionToday({ force: true });
      return;
    }

    setPending(true);
    try {
      const allowed = await canWriteQuestionToday({ force: true });
      if (!allowed) {
        window.alert(messageForCode("rate_limited"));
        return;
      }
      onBeforeNavigate?.();
      router.push("/suggest");
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" role={role} disabled={pending} onClick={() => void openSuggest()} className={className}>
      {children}
    </button>
  );
}
