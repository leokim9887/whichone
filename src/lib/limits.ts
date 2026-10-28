export const LIMITS = {
  title: 100,
  description: 500,
  option: 60,
  comment: 300,
  report: 300,
  nicknameMin: 2,
  nicknameMax: 16,
  avatarBytes: 2 * 1024 * 1024,
  minOptions: 2,
  maxOptions: 4,
  suggestionsPerDay: 5,
  search: 80,
} as const;

export const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]+$/;

export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
