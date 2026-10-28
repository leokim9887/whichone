"use client";

import { useSyncExternalStore } from "react";

import type { UserProfile } from "@/lib/types";

export const PROFILE_STORAGE_KEY = "whichone.profile.v1";
const CHANGE_EVENT = "whichone-profile-change";

let cachedRaw: string | null | undefined;
let cachedProfile: UserProfile | null = null;

function parseRaw(raw: string | null): UserProfile | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.nickname !== "string" || typeof record.avatarUrl !== "string") {
      return null;
    }
    if (!record.nickname.trim() || !record.avatarUrl.trim()) {
      return null;
    }
    return { nickname: record.nickname.trim(), avatarUrl: record.avatarUrl.trim() };
  } catch {
    return null;
  }
}

function getClientSnapshot(): UserProfile | null {
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (raw === cachedRaw) {
    return cachedProfile;
  }
  cachedRaw = raw;
  cachedProfile = parseRaw(raw);
  return cachedProfile;
}

function getServerSnapshot(): UserProfile | null {
  return null;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useDemoProfile(): UserProfile | null {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

export function readDemoProfile(): UserProfile | null {
  if (typeof window === "undefined") {
    return null;
  }
  return getClientSnapshot();
}

export function writeDemoProfile(profile: UserProfile): void {
  if (typeof window === "undefined") {
    return;
  }
  const raw = JSON.stringify(profile);
  window.localStorage.setItem(PROFILE_STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedProfile = profile;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function suggestNickname(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `어느분${n}`;
}
