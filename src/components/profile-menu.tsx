"use client";

import {
  ChevronDown,
  Lightbulb,
  MessageSquareText,
  Pencil,
  ScrollText,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { ProfileAvatar } from "@/components/profile-avatar";
import { useProfile } from "@/components/profile-provider";

const itemClass =
  "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold hover:bg-background";

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={loading}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={profile ? "프로필 메뉴" : "메뉴"}
        className="inline-flex min-h-11 max-w-[10.5rem] items-center gap-1.5 rounded-2xl border border-line bg-card px-2.5 text-sm font-semibold text-foreground disabled:opacity-60"
      >
        {profile ? (
          <>
            <ProfileAvatar profile={profile} size="sm" />
            <span className="truncate">{profile.nickname}</span>
          </>
        ) : (
          <span className="px-1">프로필</span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-card py-1 shadow-lg"
        >
          {profile ? (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                openSetup();
              }}
            >
              <Pencil className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              프로필 수정
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                openSetup();
              }}
            >
              <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              프로필 설정
            </button>
          )}
          {profile ? (
            <>
              <Link
                href="/suggest"
                role="menuitem"
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                <Lightbulb className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                질문 제안
              </Link>
              <div className="my-1 border-t border-line" role="separator" />
              <Link
                href="/me/questions"
                role="menuitem"
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                <ScrollText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                내 질문 보기
              </Link>
              <Link
                href="/me/comments"
                role="menuitem"
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                <MessageSquareText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                내가 쓴 댓글 보기
              </Link>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
