"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ProfileSetupModal } from "@/components/profile-setup";
import { isSupabaseConfigured } from "@/lib/env";
import { readDemoProfile, useDemoProfile } from "@/lib/profile-storage";
import type { DataMode, UserProfile } from "@/lib/types";
import { getMyProfileAction } from "@/server/actions";

type ProfileContextValue = {
  mode: DataMode;
  profile: UserProfile | null;
  loading: boolean;
  openSetup: () => void;
  ensureProfile: () => Promise<boolean>;
  setProfile: (profile: UserProfile) => void;
  clearProfile: () => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const mode: DataMode = isSupabaseConfigured() ? "live" : "demo";
  const demoProfile = useDemoProfile();
  const [liveProfile, setLiveProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(mode === "live");
  const [open, setOpen] = useState(false);
  const waiters = useRef<Array<(ok: boolean) => void>>([]);

  useEffect(() => {
    if (mode !== "live") {
      return;
    }
    let cancelled = false;
    void getMyProfileAction().then((profile) => {
      if (cancelled) {
        return;
      }
      setLiveProfile(profile);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const profile = mode === "demo" ? demoProfile : liveProfile;

  const resolveWaiters = useCallback((ok: boolean) => {
    const pending = waiters.current.splice(0);
    for (const resolve of pending) {
      resolve(ok);
    }
  }, []);

  const openSetup = useCallback(() => {
    setOpen(true);
  }, []);

  const ensureProfile = useCallback(async () => {
    const current = mode === "demo" ? readDemoProfile() : liveProfile;
    if (current?.nickname) {
      return true;
    }
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      waiters.current.push(resolve);
    });
  }, [liveProfile, mode]);

  const setProfile = useCallback(
    (next: UserProfile) => {
      if (mode === "live") {
        setLiveProfile(next);
      }
      setOpen(false);
      resolveWaiters(true);
    },
    [mode, resolveWaiters],
  );

  const clearProfile = useCallback(() => {
    if (mode === "live") {
      setLiveProfile(null);
    }
    setOpen(false);
    resolveWaiters(false);
  }, [mode, resolveWaiters]);

  const close = useCallback(() => {
    setOpen(false);
    resolveWaiters(false);
  }, [resolveWaiters]);

  const value = useMemo(
    () => ({
      mode,
      profile,
      loading,
      openSetup,
      ensureProfile,
      setProfile,
      clearProfile,
    }),
    [clearProfile, ensureProfile, loading, mode, openSetup, profile, setProfile],
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
      {open ? (
        <ProfileSetupModal
          key={profile ? `edit-${profile.nickname}` : "create"}
          mode={mode}
          initial={profile}
          onClose={close}
          onSaved={setProfile}
          onDeleted={clearProfile}
        />
      ) : null}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return value;
}
