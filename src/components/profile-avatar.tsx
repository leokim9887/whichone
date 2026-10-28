import type { UserProfile } from "@/lib/types";

export function ProfileAvatar({
  profile,
  size = "md",
  alt,
}: {
  profile: Pick<UserProfile, "nickname" | "avatarUrl"> | { nickname: string; avatarUrl: string | null };
  size?: "sm" | "md" | "lg";
  alt?: string;
}) {
  const dim = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-16 w-16" : "h-10 w-10";
  const text = size === "sm" ? "text-xs" : size === "lg" ? "text-lg" : "text-sm";
  const label = alt ?? `${profile.nickname} 프로필`;

  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote/user avatars and demo data URLs
      <img
        src={profile.avatarUrl}
        alt={label}
        className={`${dim} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`grid ${dim} shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent-strong ${text}`}
    >
      {profile.nickname.slice(0, 1)}
    </span>
  );
}
