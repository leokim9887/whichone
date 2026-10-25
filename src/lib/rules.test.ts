import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterQuestions, popularQuestions } from "./catalog.ts";
import { hashString, koreaDateKey, pickDailyQuestion } from "./daily.ts";
import { addDemoComment, castDemoVote, EMPTY_DEMO_STATE } from "./demo-state.ts";
import { toPercentages } from "./percentages.ts";
import { buildSummary } from "./results.ts";
import { SEED_QUESTIONS } from "./seed-questions.ts";
import { CATEGORIES } from "./types.ts";
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
  });
});

describe("suggestion and comment validation", () => {
  it("rejects a short form, duplicates, and oversized text", () => {
    const missing = validateSuggestion({
      title: "  ",
      description: "",
      category: "daily",
      options: ["하나만"],
    });
    assert.equal(missing.ok, false);

    const duplicate = validateSuggestion({
      title: "제목",
      description: "",
      category: "food",
      options: ["같은 선택", "같은 선택"],
    });
    assert.equal(duplicate.ok, false);

    const tooLong = validateSuggestion({
      title: "제".repeat(101),
      description: "",
      category: "work",
      options: ["하나", "둘"],
    });
    assert.equal(tooLong.ok, false);
  });

  it("accepts two distinct options and rejects an empty comment", () => {
    const accepted = validateSuggestion({
      title: "  점심은 무엇으로  ",
      description: "",
      category: "food",
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
  });
});

describe("catalog and seed", () => {
  it("filters by category and search text", () => {
    const food = filterQuestions(SEED_QUESTIONS, "food", "");
    assert.ok(food.every((question) => question.category === "food"));
    const found = filterQuestions(SEED_QUESTIONS, "all", "월급");
    assert.ok(found.some((question) => question.title.includes("월급")));
    assert.equal(filterQuestions(SEED_QUESTIONS, "love", "없는검색어").length, 0);
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
