export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !key) {
    return false;
  }
  if (!url.startsWith("https://")) {
    return false;
  }
  const placeholders = ["your-project", "your-anon", "replace-me", "example"];
  return !placeholders.some((placeholder) => url.includes(placeholder) || key.includes(placeholder));
}

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}
