"use client";

import { useEffect, useMemo, useState } from "react";

import { QuestionCard } from "@/components/question-card";
import { CATEGORY_FILTERS, CATEGORY_LABEL, isCategoryFilter, type CategoryFilter } from "@/lib/categories";
import { filterQuestions, latestQuestions, popularQuestions } from "@/lib/catalog";
import { LIMITS } from "@/lib/limits";
import { topicBelongsTo, topicsFor } from "@/lib/topics";
import type { DataMode, Question } from "@/lib/types";

export function HomeBrowser({
  questions,
  votedIds,
  mode,
  initialCategory,
  initialTopic,
  initialQuery,
}: {
  questions: Question[];
  votedIds: string[];
  mode: DataMode;
  initialCategory: CategoryFilter;
  initialTopic: string;
  initialQuery: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [topic, setTopic] = useState(initialTopic);
  const [query, setQuery] = useState(initialQuery);
  const voted = useMemo(() => new Set(votedIds), [votedIds]);
  const filtered = filterQuestions(questions, category, topic, query);
  const popular = popularQuestions(filtered);
  const latest = latestQuestions(filtered);

  useEffect(() => {
    function onPopState() {
      const next = readFilters(window.location.search);
      setCategory(next.category);
      setTopic(next.topic);
      setQuery(next.query);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function chooseCategory(next: CategoryFilter) {
    setCategory(next);
    setTopic("");
    writeFilters(next, "", query, true);
  }

  function chooseTopic(next: string) {
    setTopic(next);
    writeFilters(category, next, query, true);
  }

  function changeQuery(next: string) {
    const value = next.slice(0, LIMITS.search);
    setQuery(value);
    writeFilters(category, topic, value, false);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xl font-bold">주제별 질문</h2>
        <form
          className="flex w-full gap-2 sm:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <label className="sr-only" htmlFor="question-search">
            질문 검색
          </label>
          <input
            id="question-search"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="질문 검색"
            className="min-h-11 w-full rounded-2xl border border-line bg-card px-4 text-sm outline-none"
          />
          <button type="submit" className="min-h-11 shrink-0 rounded-2xl border border-line bg-card px-4 text-sm font-semibold">
            검색
          </button>
        </form>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_FILTERS.map((item) => {
          const active = item === category;
          return (
            <button
              key={item}
              type="button"
              onClick={() => chooseCategory(item)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold ${
                active ? "bg-foreground text-card" : "border border-line bg-card text-foreground"
              }`}
            >
              {item === "all" ? "전체" : CATEGORY_LABEL[item]}
            </button>
          );
        })}
      </div>
      {category !== "all" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <TopicButton
            active={!topic}
            label="이 주제 전체"
            example="모든 세부 질문을 봅니다"
            onClick={() => chooseTopic("")}
          />
          {topicsFor(category).map((item) => (
            <TopicButton
              key={item.id}
              active={topic === item.id}
              label={item.label}
              example={`${item.exampleOptions[0]} / ${item.exampleOptions[1]}`}
              onClick={() => chooseTopic(item.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-muted">
          주제를 고르면 업무, 대인관계, 연봉처럼 더 좁은 갈래와 선택 예시가 나옵니다.
        </p>
      )}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-card px-5 py-8">
          <h2 className="text-lg font-bold">{query ? "검색 결과가 없습니다" : "이 주제의 질문이 아직 없습니다"}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">다른 주제나 검색어를 선택해 보세요.</p>
        </div>
      ) : (
        <>
          <QuestionGrid
            title="참여가 많은 질문"
            note={popular.showingRecentBecauseNoVotes ? "아직 공유된 참여가 없어 최근 질문을 보여 드립니다." : null}
            questions={popular.items}
            mode={mode}
            voted={voted}
          />
          <QuestionGrid title="최신 질문" note={null} questions={latest} mode={mode} voted={voted} />
        </>
      )}
    </section>
  );
}

function TopicButton({
  active,
  label,
  example,
  onClick,
}: {
  active: boolean;
  label: string;
  example: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`rounded-2xl border px-4 py-3 text-left ${active ? "border-foreground bg-foreground text-card" : "border-line bg-card"}`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className={`mt-1 block text-xs leading-5 ${active ? "text-card/80" : "text-muted"}`}>예: {example}</span>
    </button>
  );
}

function QuestionGrid({
  title,
  note,
  questions,
  mode,
  voted,
}: {
  title: string;
  note: string | null;
  questions: Question[];
  mode: DataMode;
  voted: Set<string>;
}) {
  return (
    <div>
      <h3 className="text-lg font-bold">{title}</h3>
      {note ? <p className="mt-1 text-sm text-muted">{note}</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {questions.map((question) => (
          <QuestionCard key={question.id} question={question} mode={mode} voted={voted.has(question.id)} />
        ))}
      </div>
    </div>
  );
}

function readFilters(search: string): { category: CategoryFilter; topic: string; query: string } {
  const params = new URLSearchParams(search);
  const rawCategory = params.get("category") ?? "";
  const category = isCategoryFilter(rawCategory) ? rawCategory : "all";
  const rawTopic = params.get("topic") ?? "";
  const topic = category !== "all" && topicBelongsTo(rawTopic, category) ? rawTopic : "";
  const query = (params.get("q") ?? "").trim().slice(0, LIMITS.search);
  return { category, topic, query };
}

function writeFilters(category: CategoryFilter, topic: string, query: string, push: boolean) {
  const params = new URLSearchParams();
  if (category !== "all") {
    params.set("category", category);
  }
  if (category !== "all" && topic) {
    params.set("topic", topic);
  }
  const trimmed = query.trim();
  if (trimmed) {
    params.set("q", trimmed);
  }
  const next = params.size > 0 ? `/?${params.toString()}` : "/";
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === next) {
    return;
  }
  if (push) {
    window.history.pushState(null, "", next);
    return;
  }
  window.history.replaceState(null, "", next);
}
