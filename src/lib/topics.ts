import { categoryLabel } from "@/lib/categories";
import type { Category } from "@/lib/types";

export type Topic = {
  id: string;
  category: Category;
  label: string;
  exampleTitle: string;
  exampleOptions: [string, string];
};

export const TOPICS: readonly Topic[] = [
  {
    id: "routine",
    category: "daily",
    label: "아침·루틴",
    exampleTitle: "주말 아침, 알람 없이 일어날 수 있다면?",
    exampleOptions: ["늦잠으로 시작한다", "평소와 비슷하게 일어난다"],
  },
  {
    id: "time",
    category: "daily",
    label: "시간·여가",
    exampleTitle: "갑자기 생긴 두 시간, 어디에 쓸까?",
    exampleOptions: ["집에서 쉰다", "밖으로 나가 걷는다"],
  },
  {
    id: "habit",
    category: "daily",
    label: "하루의 마무리",
    exampleTitle: "하루를 마칠 때 더 남기고 싶은 것은?",
    exampleOptions: ["아무것도 안 한 휴식", "작게라도 해낸 기록"],
  },
  {
    id: "contact",
    category: "love",
    label: "연락",
    exampleTitle: "연락이 뜸해졌을 때 먼저 어떻게 할까?",
    exampleOptions: ["먼저 안부를 보낸다", "상대의 연락을 기다린다"],
  },
  {
    id: "boundary",
    category: "love",
    label: "경계·신뢰",
    exampleTitle: "연인이 이성 친구와 단둘이 여행을 가는 것은?",
    exampleOptions: ["괜찮다. 신뢰를 우선한다", "미리 이야기를 나누고 싶다"],
  },
  {
    id: "date",
    category: "love",
    label: "데이트",
    exampleTitle: "데이트 비용은 어떻게 나누는 편이 편한가?",
    exampleOptions: ["번갈아 한 사람이 낸다", "매번 정확히 나눈다"],
  },
  {
    id: "save",
    category: "money",
    label: "저축·소비",
    exampleTitle: "월급이 생기면 저축과 경험 중 무엇을 우선할까?",
    exampleOptions: ["저축을 먼저 채운다", "경험에 먼저 쓴다"],
  },
  {
    id: "income",
    category: "money",
    label: "수입·시간",
    exampleTitle: "돈을 더 벌 수 있다면 여가 시간을 줄일 수 있을까?",
    exampleOptions: ["줄일 수 있다", "줄이기 어렵다"],
  },
  {
    id: "windfall",
    category: "money",
    label: "목돈",
    exampleTitle: "예상치 못한 보너스가 생겼다면?",
    exampleOptions: ["저축하거나 빚을 갚는다", "필요했던 것을 산다"],
  },
  {
    id: "task",
    category: "work",
    label: "업무",
    exampleTitle: "의견이 다를 때 회의에서 나는?",
    exampleOptions: ["바로 의견을 말한다", "정리한 뒤 따로 전한다"],
  },
  {
    id: "people",
    category: "work",
    label: "대인관계",
    exampleTitle: "첫 직장에서 사람을 볼 때 더 중요한 것은?",
    exampleOptions: ["함께 일하는 분위기", "배울 수 있는 동료"],
  },
  {
    id: "pay",
    category: "work",
    label: "연봉",
    exampleTitle: "이직을 고민할 때 보상은 어느 정도 중요한가?",
    exampleOptions: ["보상의 크기를 우선한다", "당장은 적어도 성장을 고른다"],
  },
  {
    id: "menu",
    category: "food",
    label: "메뉴",
    exampleTitle: "평생 한 가지 음식만 먹어야 한다면?",
    exampleOptions: ["익숙한 밥과 반찬", "좋아하는 면 요리"],
  },
  {
    id: "alone",
    category: "food",
    label: "혼밥",
    exampleTitle: "혼자 식사할 때 더 끌리는 곳은?",
    exampleOptions: ["익숙한 집 근처 식당", "집에서 간단하게 해결"],
  },
  {
    id: "together",
    category: "food",
    label: "함께 먹기",
    exampleTitle: "함께 먹는 메뉴가 갈릴 때 나는?",
    exampleOptions: ["먹고 싶은 곳을 먼저 말한다", "상대의 의견에 맞춘다"],
  },
  {
    id: "relation",
    category: "values",
    label: "관계",
    exampleTitle: "약속 시간에 늦은 친구에게 나는?",
    exampleOptions: ["기다린 시간을 솔직히 말한다", "별일 아닌 듯 넘긴다"],
  },
  {
    id: "help",
    category: "values",
    label: "도움",
    exampleTitle: "모르는 사람에게 도움을 부탁받았다면?",
    exampleOptions: ["할 수 있는 범위에서 돕는다", "상황을 보고 거절할 수도 있다"],
  },
  {
    id: "rest",
    category: "values",
    label: "쉬는 시간",
    exampleTitle: "휴일에 연락이 왔을 때 더 중요한 것은?",
    exampleOptions: ["바로 답하는 성의", "쉰 뒤에 답하는 여유"],
  },
];

const TOPIC_BY_ID = new Map(TOPICS.map((topic) => [topic.id, topic]));

export function isTopic(value: string): boolean {
  return TOPIC_BY_ID.has(value);
}

export function topicById(id: string | null | undefined): Topic | null {
  if (!id) {
    return null;
  }
  return TOPIC_BY_ID.get(id) ?? null;
}

export function topicsFor(category: Category): Topic[] {
  return TOPICS.filter((topic) => topic.category === category);
}

export function topicBelongsTo(topicId: string, category: Category): boolean {
  return topicById(topicId)?.category === category;
}

export function categoryTopicLabel(category: Category, topic: string | null): string {
  const detail = topicById(topic)?.label;
  const base = categoryLabel(category);
  return detail ? `${base} · ${detail}` : base;
}
