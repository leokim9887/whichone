"use client";

import { ChevronDown, MessageSquareText, Pencil, ScrollText } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { ProfileAvatar } from "@/components/profile-avatar";
import { useProfile } from "@/components/profile-provider";

export function ProfileMenu() {
  const { profile, openSetup, loading } = useProfile();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!profile) {
    return (
      <button
        type="button"
        onClick={openSetup}
        disabled={loading}
        className="inline-flex min-h-11 items-center rounded-2xl border border-line bg-card px-3 text-sm font-semibold text-foreground disabled:opacity-60"
        aria-label="프로필 설정"
      >
        프로필
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={loading}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className="inline-flex min-h-11 max-w-[10.5rem] items-center gap-1.5 rounded-2xl border border-line bg-card px-2.5 text-sm font-semibold text-foreground disabled:opacity-60"
      >
        <ProfileAvatar profile={profile} size="sm" />
        <span className="truncate">{profile.nickname}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-2xl border border-line bg-card py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold hover:bg-background"
            onClick={() => {
              setOpen(false);
              openSetup();
            }}
          >
            <Pencil className="h-4 w-4 text-muted" aria-hidden="true" />
            프로필 수정
          </button>
          <Link
            href="/me/questions"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold hover:bg-background"
            onClick={() => setOpen(false)}
          >
            <ScrollText className="h-4 w-4 text-muted" aria-hidden="true" />
            내 질문 보기
          </Link>
          <Link
            href="/me/comments"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold hover:bg-background"
            onClick={() => setOpen(false)}
          >
            <MessageSquareText className="h-4 w-4 text-muted" aria-hidden="true" />
            내가 쓴 댓글 보기
          </Link>
        </div>
      ) : null}
    </div>
  );
}
