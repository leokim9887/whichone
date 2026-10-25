import type { Category, Option, Question } from "@/lib/types";

let optionSerial = 1;

function optionId(serial: number): string {
  return `20000000-0000-4000-8000-${String(serial).padStart(12, "0")}`;
}

function questionId(serial: number): string {
  return `10000000-0000-4000-8000-${String(serial).padStart(12, "0")}`;
}

function makeOptions(texts: string[]): Option[] {
  return texts.map((text, position) => {
    const id = optionId(optionSerial);
    optionSerial += 1;
    return { id, text, position };
  });
}

function makeQuestion(
  serial: number,
  category: Category,
  title: string,
  description: string,
  optionTexts: string[],
  topic: string,
): Question {
  const publishedAt = `2026-09-${String(serial).padStart(2, "0")}T00:00:00.000Z`;
  return {
    id: questionId(serial),
    title,
    description,
    category,
    topic,
    publishedAt,
    createdAt: publishedAt,
    dailyFeatureDate: null,
    participantCount: 0,
    options: makeOptions(optionTexts),
  };
}

export const SEED_QUESTIONS: Question[] = [
  makeQuestion(
    1,
    "daily",
    "주말 아침, 알람 없이 일어날 수 있다면?",
    "쉬어야 하는 날의 아침을 어떻게 시작하고 싶은지 고르는 질문입니다.",
    ["늦잠으로 하루를 시작한다", "평소와 비슷한 시간에 일어난다", "더 일찍 일어나 여유를 만든다"],
    "routine",
  ),
  makeQuestion(
    2,
    "daily",
    "하루를 마칠 때 더 남기고 싶은 것은?",
    "같은 하루라도 무엇을 남기고 싶은지는 사람마다 다릅니다.",
    ["아무것도 하지 않은 완전한 휴식", "작게라도 해낸 일의 기록", "누군가와 나눈 대화"],
    "habit",
  ),
  makeQuestion(
    3,
    "daily",
    "갑자기 생긴 두 시간의 자유, 어디에 쓸까?",
    "예상하지 못한 빈 시간이 생겼을 때의 선택입니다.",
    ["집에서 혼자 쉰다", "밖으로 나가 걷는다", "미뤄 둔 일을 끝낸다"],
    "time",
  ),
  makeQuestion(
    4,
    "love",
    "연인이 이성 친구와 단둘이 여행을 가는 것은 괜찮을까?",
    "정답보다 서로의 기준을 확인하는 질문입니다.",
    ["괜찮다. 신뢰를 우선한다", "불편하다. 미리 이야기를 나누고 싶다", "상황과 관계에 따라 다르다"],
    "boundary",
  ),
  makeQuestion(
    5,
    "love",
    "데이트 비용을 나누는 방식, 어느 쪽이 편한가?",
    "돈을 나누는 방식도 관계의 리듬이 됩니다.",
    ["번갈아 한 사람이 낸다", "매번 정확히 나눈다", "여유 있는 사람이 더 낸다"],
    "date",
  ),
  makeQuestion(
    6,
    "love",
    "연락이 뜸해졌을 때 먼저 어떻게 할까?",
    "서운함과 기다림 사이에서 고르는 질문입니다.",
    ["먼저 안부를 보낸다", "상대의 연락을 기다린다", "만나서 직접 이야기한다"],
    "contact",
  ),
  makeQuestion(
    7,
    "money",
    "월급이 생기면 저축과 경험 중 무엇을 우선할까?",
    "오늘의 소비와 내일의 여유 중 어디에 무게를 둘지 묻습니다.",
    ["저축을 먼저 채운다", "경험에 먼저 쓴다", "비율을 정해 둘 다 한다"],
    "save",
  ),
  makeQuestion(
    8,
    "money",
    "돈을 더 많이 벌 수 있다면 여가 시간을 줄일 수 있을까?",
    "수입과 시간을 바꿀 수 있는 조건을 생각해 보는 질문입니다.",
    ["줄일 수 있다", "줄이기 어렵다", "기간을 정해 둔다면 가능하다"],
    "income",
  ),
  makeQuestion(
    9,
    "money",
    "예상치 못한 보너스가 생겼다면?",
    "계획에 없던 돈을 어디에 두고 싶은지 고릅니다.",
    ["바로 저축하거나 빚을 갚는다", "필요했던 물건을 산다", "사람과의 경험에 쓴다", "일부를 나눠 기부한다"],
    "windfall",
  ),
  makeQuestion(
    10,
    "work",
    "첫 직장에서 가장 중요하게 봐야 하는 것은?",
    "처음 일하는 곳에서 무엇을 기준으로 삼고 싶은지 묻습니다.",
    ["함께 일하는 사람", "배울 수 있는 일", "연봉과 처우", "성장에 쓸 수 있는 시간"],
    "people",
  ),
  makeQuestion(
    11,
    "work",
    "의견이 다를 때 회의에서 나는?",
    "말이 빠른 것과 정확한 것은 다를 수 있습니다.",
    ["바로 의견을 말한다", "정리한 뒤 따로 전한다", "다른 사람의 이야기를 먼저 듣는다"],
    "task",
  ),
  makeQuestion(
    12,
    "work",
    "이직을 고민할 때 마지막 기준은?",
    "여러 조건 중 마지막에 남는 기준을 고릅니다.",
    ["일의 의미", "삶의 여유", "보상의 크기", "함께할 팀"],
    "pay",
  ),
  makeQuestion(
    13,
    "food",
    "평생 한 가지 음식만 먹어야 한다면?",
    "맛과 익숙함 사이에서 하나만 남긴다면 무엇을 고를까요?",
    ["익숙한 밥과 반찬", "좋아하는 면 요리", "고기를 중심으로 한 식사", "빵과 간단한 사이드"],
    "menu",
  ),
  makeQuestion(
    14,
    "food",
    "혼자 식사할 때 더 끌리는 곳은?",
    "혼밥의 분위기를 고르는 질문입니다.",
    ["익숙한 집 근처 식당", "처음 가 보는 가게", "집에서 간단하게 해결"],
    "alone",
  ),
  makeQuestion(
    15,
    "food",
    "함께 먹는 메뉴가 갈릴 때 나는?",
    "같이 먹는 자리에서 의견을 어떻게 모으는지 묻습니다.",
    ["먹고 싶은 곳을 먼저 제안한다", "상대의 의견에 맞춘다", "후보를 두 개 두고 정한다"],
    "together",
  ),
  makeQuestion(
    16,
    "values",
    "약속 시간에 늦은 친구에게 나는?",
    "관계를 지키면서 내 시간도 말하는 방식에 대한 질문입니다.",
    ["기다린 시간을 솔직히 말한다", "별일 아닌 듯 넘긴다", "다음 약속 시간을 조정하자고 한다"],
    "relation",
  ),
  makeQuestion(
    17,
    "values",
    "모르는 사람에게 도움을 부탁받았다면?",
    "도움을 거절하는 일과 건네는 일 모두 선택이 될 수 있습니다.",
    ["할 수 있는 범위에서 돕는다", "상황을 보고 거절할 수도 있다", "도와줄 수 있는 다른 방법을 찾는다"],
    "help",
  ),
  makeQuestion(
    18,
    "values",
    "휴일에 연락이 왔을 때 더 중요한 것은?",
    "쉬는 시간과 관계의 신호 사이에서 기준을 고릅니다.",
    ["바로 답하는 성의", "쉰 뒤에 답하는 여유", "급한 일인지 먼저 구분하는 것"],
    "rest",
  ),
];

export function getSeedQuestions(): Question[] {
  return SEED_QUESTIONS.map((question) => ({
    ...question,
    options: question.options.map((option) => ({ ...option })),
  }));
}
