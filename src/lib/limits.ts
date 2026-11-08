export const LIMITS = {
  title: 100,
  description: 500,
  option: 60,
  comment: 300,
  report: 300,
  nicknameMin: 2,
  nicknameMax: 16,
  avatarBytes: 2 * 1024 * 1024,
  questionImageBytes: 2 * 1024 * 1024,
  maxQuestionImages: 8,
  minOptions: 2,
  maxOptions: 8,
  suggestionsPerDay: 3,
  search: 80,
} as const;

export const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]+$/;

export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const QUESTION_IMAGE_MIME_TYPES = AVATAR_MIME_TYPES;
