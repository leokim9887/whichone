"use client";

import Link from "next/link";

import { ProfileAvatar } from "@/components/profile-avatar";
import { useProfile } from "@/components/profile-provider";

export function SiteHeader() {
  const { profile, openSetup, loading } = useProfile();

  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex min-h-11 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-accent text-sm font-bold text-white">
            W
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">
            Whic<span className="text-accent">H</span>One
          </span>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <button
            type="button"
            onClick={openSetup}
            disabled={loading}
            className="inline-flex min-h-11 max-w-[9.5rem] items-center gap-2 rounded-2xl border border-line bg-card px-2.5 text-foreground disabled:opacity-60"
            aria-label={profile ? "프로필 수정" : "프로필 설정"}
          >
            {profile ? (
              <>
                <ProfileAvatar profile={profile} size="sm" />
                <span className="truncate">{profile.nickname}</span>
              </>
            ) : (
              <span className="px-1">프로필</span>
            )}
          </button>
          <Link
            href="/suggest"
            className="inline-flex min-h-11 items-center rounded-2xl bg-accent px-3 text-white hover:bg-accent-strong"
          >
            질문 제안
          </Link>
        </nav>
      </div>
    </header>
  );
}
