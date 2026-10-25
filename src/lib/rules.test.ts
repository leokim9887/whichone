import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adoptServerComments, insertReply, removeReply, toggleLocalLike } from "./comment-updates.ts";
import { filterQuestions, popularQuestions } from "./catalog.ts";
import { hashString, isDateKey, koreaDateKey, pickDailyQuestion, pickDailyQuestions } from "./daily.ts";
import { addDemoComment, addDemoReply, castDemoVote, EMPTY_DEMO_STATE, toggleDemoLike } from "./demo-state.ts";
import { parsePublicComments } from "./parsers.ts";
import { toPercentages } from "./percentages.ts";
import { buildSummary } from "./results.ts";
import { SEED_QUESTIONS } from "./seed-questions.ts";
import { CATEGORIES } from "./types.ts";
import { topicBelongsTo } from "./topics.ts";
import { validateComment, validateSuggestion } from "./validation.ts";

describe("percentages", () => {
  it("returns zeros when nobody has voted", () => {
    assert.deepEqual(toPercentages([0, 0, 0]), [0, 0, 0]);
    assert.equal(
      toPercentages([0, 0, 0]).reduce((sum, value) => sum + value, 0),
      0,
    );
  });

  it("makes rounded percentages add up to 100", () => {
    const cases = [
      [1, 1],
      [1, 1, 1],
      [2, 1],
      [5, 1, 1],
      [0, 3],
    ];
    for (const counts of cases) {
      const percentages = toPercentages(counts);
      assert.equal(
        percentages.reduce((sum, value) => sum + value, 0),
        100,
      );
    }
    assert.deepEqual(toPercentages([1, 1]), [50, 50]);
    assert.deepEqual(toPercentages([2, 1]), [67, 33]);
  });
});

describe("results", () => {
  const options = [
    { id: "a", text: "가", position: 0 },
    { id: "b", text: "나", position: 1 },
  ];

  it("does not invent a result before counts exist", () => {
    assert.equal(buildSummary(options, null, null), null);
  });

  it("handles an empty tally and a tie", () => {
    const empty = buildSummary(
      options,
      [
        { optionId: "a", voteCount: 0 },
        { optionId: "b", voteCount: 0 },
      ],
      null,
    );
    assert.equal(empty?.total, 0);
    assert.deepEqual(empty?.leaderIds, []);

    const tie = buildSummary(
      options,
      [
        { optionId: "a", voteCount: 2 },
        { optionId: "b", voteCount: 2 },
      ],
      "a",
    );
    assert.deepEqual(tie?.leaderIds, ["a", "b"]);
    assert.equal(tie?.options[0]?.isMine, true);
    assert.equal(
      tie?.options.reduce((sum, option) => sum + option.percentage, 0),
      100,
    );
  });
});

describe("daily question", () => {
  it("uses the Korea date, not UTC", () => {
    assert.equal(koreaDateKey(new Date("2026-10-23T14:30:00.000Z")), "2026-10-23");
    assert.equal(koreaDateKey(new Date("2026-10-23T15:30:00.000Z")), "2026-10-24");
    assert.equal(isDateKey("2026-10-25"), true);
    assert.equal(isDateKey("2026-02-31"), false);
  });

  it("picks the same question for the same date and prefers a featured date", () => {
    const questions = [
      { id: "b", dailyFeatureDate: null },
      { id: "a", dailyFeatureDate: "2026-10-23" },
    ];
    assert.equal(pickDailyQuestion([], "2026-10-23"), null);
    assert.equal(pickDailyQuestion(questions, "2026-10-23")?.id, "a");
    const first = pickDailyQuestion(SEED_QUESTIONS, "2026-11-02");
    const second = pickDailyQuestion(SEED_QUESTIONS, "2026-11-02");
    assert.equal(first?.id, second?.id);
    assert.equal(typeof hashString("2026-11-02"), "number");
    const daily = pickDailyQuestions(SEED_QUESTIONS, "2026-11-02");
    const again = pickDailyQuestions(SEED_QUESTIONS, "2026-11-02");
    assert.deepEqual(
      daily.map((question) => question.id),
      again.map((question) => question.id),
    );
    assert.equal(new Set(daily.map((question) => question.category)).size, daily.length);
    assert.equal(daily.length, 6);
  });
});

describe("suggestion and comment validation", () => {
  it("rejects a short form, duplicates, and oversized text", () => {
    const missing = validateSuggestion({
      title: "  ",
      description: "",
      category: "daily",
      topic: "routine",
      options: ["하나만"],
    });
    assert.equal(missing.ok, false);

    const duplicate = validateSuggestion({
      title: "제목",
      description: "",
      category: "food",
      topic: "menu",
      options: ["같은 선택", "같은 선택"],
    });
    assert.equal(duplicate.ok, false);

    const tooLong = validateSuggestion({
      title: "제".repeat(101),
      description: "",
      category: "work",
      topic: "task",
      options: ["하나", "둘"],
    });
    assert.equal(tooLong.ok, false);
  });

  it("accepts two distinct options and rejects an empty comment", () => {
    const accepted = validateSuggestion({
      title: "  점심은 무엇으로  ",
      description: "",
      category: "food",
      topic: "menu",
      options: [" 김치찌개 ", "된장찌개", ""],
    });
    assert.equal(accepted.ok, true);
    if (accepted.ok) {
      assert.deepEqual(accepted.value.options, ["김치찌개", "된장찌개"]);
    }

    assert.equal(validateComment("   ").ok, false);
    assert.equal(validateComment("가".repeat(301)).ok, false);
    const comment = validateComment("  그냥 익숙해서  ");
    assert.equal(comment.ok, true);
  });
});

describe("demo votes", () => {
  it("stores one vote per question and refuses a second vote", () => {
    const first = castDemoVote(EMPTY_DEMO_STATE, "q1", "o1", ["o1", "o2"], "2026-10-23T00:00:00.000Z");
    assert.equal(first.ok, true);
    if (!first.ok) {
      return;
    }
    const second = castDemoVote(first.state, "q1", "o2", ["o1", "o2"]);
    assert.deepEqual(second, { ok: false, code: "already_voted" });
    const wrong = castDemoVote(EMPTY_DEMO_STATE, "q1", "other", ["o1", "o2"]);
    assert.equal(wrong.ok, false);

    const withoutVote = addDemoComment(EMPTY_DEMO_STATE, "q1", "이유");
    assert.equal(withoutVote.ok, false);
    const withVote = addDemoComment(first.state, "q1", "이유");
    assert.equal(withVote.ok, true);
    if (!withVote.ok) {
      return;
    }
    const reply = addDemoReply(withVote.state, "q1", withVote.value.id, "그 기준도 중요해요");
    assert.equal(reply.ok, true);
    if (!reply.ok) {
      return;
    }
    const secondReply = addDemoReply(reply.state, "q1", withVote.value.id, "한 번 더");
    assert.deepEqual(secondReply, { ok: false, code: "already_replied" });
    const ownLike = toggleDemoLike(reply.state, "q1", withVote.value.id);
    assert.deepEqual(ownLike, { ok: false, code: "own_like" });
  });
});

describe("comment threads", () => {
  it("reads likes and one level of replies", () => {
    const comments = parsePublicComments([
      {
        id: "c1",
        optionId: "o1",
        body: "이유",
        createdAt: "2026-10-26T00:00:00.000Z",
        likeCount: 2,
        likedByMe: true,
        mine: false,
        replies: [
          {
            id: "r1",
            optionId: "o2",
            body: "답글",
            createdAt: "2026-10-26T01:00:00.000Z",
            likeCount: 0,
            likedByMe: false,
            mine: true,
          },
        ],
      },
    ]);
    assert.equal(comments[0]?.likeCount, 2);
    assert.equal(comments[0]?.replies[0]?.mine, true);
    const legacy = parsePublicComments([
      { id: "c2", optionId: "o1", body: "예전 의견", createdAt: "2026-10-26T00:00:00.000Z" },
    ]);
    assert.deepEqual(legacy[0]?.replies, []);
    assert.equal(legacy[0]?.likeCount, 0);
  });
});

describe("comment updates", () => {
  const thread = [
    {
      id: "c1",
      optionId: "o1",
      body: "이유",
      createdAt: "2026-10-26T00:00:00.000Z",
      likeCount: 1,
      likedByMe: false,
      mine: false,
      replies: [
        {
          id: "r1",
          optionId: "o2",
          body: "답글",
          createdAt: "2026-10-26T01:00:00.000Z",
          likeCount: 0,
          likedByMe: false,
          mine: true,
        },
      ],
    },
  ];

  it("toggles a recommendation immediately and leaves my own reply unchanged", () => {
    const liked = toggleLocalLike(thread, "c1");
    assert.equal(liked[0]?.likedByMe, true);
    assert.equal(liked[0]?.likeCount, 2);
    const own = toggleLocalLike(liked, "r1");
    assert.equal(own[0]?.replies[0]?.likedByMe, false);
    const undone = toggleLocalLike(liked, "c1");
    assert.equal(undone[0]?.likeCount, 1);
  });

  it("shows a reply at once and keeps the new recommendation when the server list arrives", () => {
    const withReply = insertReply(thread, "c1", {
      id: "pending-1",
      optionId: "o1",
      body: "바로 보이는 답글",
      createdAt: "2026-10-26T02:00:00.000Z",
      likeCount: 0,
      likedByMe: false,
      mine: true,
    });
    assert.equal(withReply[0]?.replies[1]?.body, "바로 보이는 답글");
    const liked = toggleLocalLike(withReply, "c1");
    const server = removeReply(withReply, "pending-1");
    const adopted = adoptServerComments(liked, [
      {
        ...server[0],
        likedByMe: false,
        likeCount: 1,
        replies: [
          ...server[0].replies,
          {
            id: "real-reply",
            optionId: "o1",
            body: "바로 보이는 답글",
            createdAt: "2026-10-26T02:00:00.000Z",
            likeCount: 0,
            likedByMe: false,
            mine: true,
          },
        ],
      },
    ]);
    assert.equal(adopted[0]?.likedByMe, true);
    assert.equal(adopted[0]?.likeCount, 2);
    assert.equal(adopted[0]?.replies.some((reply) => reply.id === "pending-1"), false);
    assert.equal(adopted[0]?.replies.some((reply) => reply.id === "real-reply"), true);
  });
});

describe("catalog and seed", () => {
  it("filters by category and search text", () => {
    const food = filterQuestions(SEED_QUESTIONS, "food", "", "");
    assert.ok(food.every((question) => question.category === "food"));
    const menus = filterQuestions(SEED_QUESTIONS, "food", "menu", "");
    assert.ok(menus.length > 0);
    assert.ok(menus.every((question) => question.topic === "menu"));
    const found = filterQuestions(SEED_QUESTIONS, "all", "", "월급");
    assert.ok(found.some((question) => question.title.includes("월급")));
    assert.equal(filterQuestions(SEED_QUESTIONS, "love", "", "없는검색어").length, 0);
  });

  it("does not pretend there is a popular ranking before any shared votes", () => {
    const popular = popularQuestions(SEED_QUESTIONS);
    assert.equal(popular.showingRecentBecauseNoVotes, true);
    assert.ok(popular.items.every((question) => question.participantCount === 0));
  });

  it("ships at least 15 reviewed questions across every category", () => {
    assert.ok(SEED_QUESTIONS.length >= 15);
    for (const category of CATEGORIES) {
      const matches = SEED_QUESTIONS.filter((question) => question.category === category);
      assert.ok(matches.length >= 2, category);
    }
    for (const question of SEED_QUESTIONS) {
      assert.equal(topicBelongsTo(question.topic ?? "", question.category), true);
    }
    const titles = new Set<string>();
    for (const question of SEED_QUESTIONS) {
      assert.ok(question.title.length <= 100);
      assert.ok(question.options.length >= 2 && question.options.length <= 4);
      const texts = question.options.map((option) => option.text);
      assert.equal(new Set(texts).size, texts.length);
      titles.add(question.title);
    }
    assert.equal(titles.size, SEED_QUESTIONS.length);
  });
});
