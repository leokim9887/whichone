"use client";

import { useSyncExternalStore } from "react";

import type { UserProfile } from "@/lib/types";

export const PROFILE_STORAGE_KEY = "whichone.profile.v1";
export const DEMO_NICKNAMES_KEY = "whichone.demo.nicknames.v1";
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
    if (typeof record.nickname !== "string" || !record.nickname.trim()) {
      return null;
    }
    const avatarUrl =
      typeof record.avatarUrl === "string" && record.avatarUrl.trim() ? record.avatarUrl.trim() : null;
    return { nickname: record.nickname.trim(), avatarUrl };
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

function readDemoNicknames(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(DEMO_NICKNAMES_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function isDemoNicknameTaken(nickname: string, current?: string | null): boolean {
  const target = nickname.trim().toLowerCase();
  const mine = current?.trim().toLowerCase() ?? "";
  if (!target) {
    return false;
  }
  return readDemoNicknames().some((item) => {
    const value = item.trim().toLowerCase();
    return value === target && value !== mine;
  });
}

export function writeDemoProfile(profile: UserProfile): void {
  if (typeof window === "undefined") {
    return;
  }
  const previous = readDemoProfile();
  const nicknames = new Set(readDemoNicknames().map((item) => item.trim().toLowerCase()));
  if (previous?.nickname) {
    nicknames.delete(previous.nickname.trim().toLowerCase());
  }
  nicknames.add(profile.nickname.trim().toLowerCase());
  window.localStorage.setItem(DEMO_NICKNAMES_KEY, JSON.stringify([...nicknames]));

  const raw = JSON.stringify(profile);
  window.localStorage.setItem(PROFILE_STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedProfile = profile;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearDemoProfile(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(DEMO_NICKNAMES_KEY);
  window.localStorage.removeItem(PROFILE_STORAGE_KEY);
  cachedRaw = null;
  cachedProfile = null;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function suggestNickname(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `어느분${n}`;
}
