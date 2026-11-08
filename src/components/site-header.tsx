"use client";

import Link from "next/link";

import { ProfileMenu } from "@/components/profile-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-background/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3">
        <Link href="/" className="group flex min-h-11 min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-accent text-sm font-bold text-white shadow-[0_8px_18px_rgba(47,75,255,0.28)] transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_24px_rgba(47,75,255,0.34)] sm:h-9 sm:w-9">
            W
          </span>
          <span className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg">
            Whic<span className="text-accent">H</span>One
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-2 text-sm font-semibold">
          <ProfileMenu />
        </nav>
      </div>
    </header>
  );
}
