"use client";

import { useSyncExternalStore } from "react";

import { EMPTY_DEMO_STATE, isDemoState, normalizeDemoComments, type DemoState } from "@/lib/demo-state";

export const DEMO_STORAGE_KEY = "whichone.demo.v1";
const CHANGE_EVENT = "whichone-demo-change";

let cachedRaw: string | null | undefined;
let cachedState: DemoState = EMPTY_DEMO_STATE;

function parseRaw(raw: string | null): DemoState {
  if (!raw) {
    return EMPTY_DEMO_STATE;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isDemoState(parsed)) {
      return EMPTY_DEMO_STATE;
    }
    return {
      ...parsed,
      comments: normalizeDemoComments(parsed.comments),
      replies: Array.isArray(parsed.replies) ? parsed.replies : [],
      likes: parsed.likes && typeof parsed.likes === "object" ? parsed.likes : {},
    };
  } catch {
    return EMPTY_DEMO_STATE;
  }
}

function getClientSnapshot(): DemoState {
  const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
  if (raw === cachedRaw) {
    return cachedState;
  }
  cachedRaw = raw;
  cachedState = parseRaw(raw);
  return cachedState;
}

function getServerSnapshot(): DemoState {
  return EMPTY_DEMO_STATE;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

export function readDemoState(): DemoState {
  if (typeof window === "undefined") {
    return EMPTY_DEMO_STATE;
  }
  return getClientSnapshot();
}

export function writeDemoState(state: DemoState): void {
  if (typeof window === "undefined") {
    return;
  }
  const raw = JSON.stringify(state);
  window.localStorage.setItem(DEMO_STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedState = state;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
