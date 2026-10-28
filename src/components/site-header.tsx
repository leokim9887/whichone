"use client";

import Link from "next/link";

import { ProfileMenu } from "@/components/profile-menu";

export function SiteHeader() {
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
          <ProfileMenu />
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
