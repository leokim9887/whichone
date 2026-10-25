"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/env";

let client: SupabaseClient | null = null;

export function browserSupabase(): SupabaseClient | null {
  if (client) {
    return client;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key || !isSupabaseConfigured()) {
    return null;
  }
  client = createBrowserClient(url, key);
  return client;
}
