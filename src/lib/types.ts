export const CATEGORIES = [
  "daily",
  "love",
  "money",
  "work",
  "food",
  "values",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type DataMode = "demo" | "live";

export type QuestionStatus = "draft" | "published" | "hidden";

export type SuggestionStatus = "pending" | "approved" | "rejected";

export type CommentStatus = "visible" | "hidden" | "deleted";

export type ReportTarget = "question" | "comment";

export type ReportReason =
  | "personal_info"
  | "abuse"
  | "spam"
  | "off_topic"
  | "other";

export type Option = {
  id: string;
  text: string;
  position: number;
};

export type Question = {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  publishedAt: string;
  createdAt: string;
  dailyFeatureDate: string | null;
  participantCount: number;
  options: Option[];
};

export type OptionCount = {
  optionId: string;
  voteCount: number;
};

export type ResultOption = {
  optionId: string;
  text: string;
  voteCount: number;
  percentage: number;
  isMine: boolean;
  isLeader: boolean;
};

export type ResultSummary = {
  total: number;
  leaderIds: string[];
  options: ResultOption[];
};

export type PublicComment = {
  id: string;
  optionId: string;
  body: string;
  createdAt: string;
};

export type OwnComment = PublicComment & {
  status: CommentStatus;
};

export type Participation = {
  participantCount: number;
  voted: boolean;
  optionId: string | null;
  comment: OwnComment | null;
  counts: OptionCount[] | null;
};

export type SuggestionDraft = {
  title: string;
  description: string;
  category: Category;
  options: string[];
};

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "personal_info", label: "개인정보가 포함되어 있습니다" },
  { id: "abuse", label: "욕설이나 혐오 표현이 있습니다" },
  { id: "spam", label: "스팸 또는 광고입니다" },
  { id: "off_topic", label: "주제와 관련이 없습니다" },
  { id: "other", label: "기타" },
];
