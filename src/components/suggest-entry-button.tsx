"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { messageForCode } from "@/lib/messages";
import { canWriteQuestionToday } from "@/lib/suggest-quota";

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
    setPending(true);
    try {
      const allowed = await canWriteQuestionToday();
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
