"use client";

import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { QuestionCard } from "@/components/question-card";
import { CATEGORY_LABEL, isCategoryFilter, type CategoryFilter } from "@/lib/categories";
import { filterQuestions, sortQuestions, type QuestionSort } from "@/lib/catalog";
import { LIMITS } from "@/lib/limits";
import { topicBelongsTo, topicsFor } from "@/lib/topics";
import { CATEGORIES, type Category, type DataMode, type Question } from "@/lib/types";

const CATEGORY_IMAGE: Record<Category, string> = {
  daily: "/categories/daily.jpg",
  love: "/categories/love-date.jpg",
  money: "/categories/money.jpg",
  work: "/categories/work-office.jpg",
  food: "/categories/food.jpg",
  values: "/categories/values.jpg",
};

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
  const [sort, setSort] = useState<QuestionSort>("popular");
  const voted = useMemo(() => new Set(votedIds), [votedIds]);
  const counts = useMemo(() => {
    const tally = new Map<Category, number>();
    for (const question of questions) {
      tally.set(question.category, (tally.get(question.category) ?? 0) + 1);
    }
    return tally;
  }, [questions]);
  const filtered = filterQuestions(questions, category, topic, query);
  const sorted = sortQuestions(filtered, sort);
  const browsingTopics = category === "all" && query.trim().length === 0;

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
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">주제별 질문</h2>
          <p className="mt-1 text-sm text-muted">주제를 고르면 그 안의 질문이 열립니다.</p>
        </div>
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
            className="min-h-11 w-full rounded-2xl border border-line bg-card px-4 text-sm outline-none transition duration-300 focus:border-foreground"
          />
          <button type="submit" className="min-h-11 shrink-0 rounded-2xl border border-line bg-card px-4 text-sm font-semibold">
            검색
          </button>
        </form>
      </div>

      {browsingTopics ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((item, index) => (
            <CategoryCard
              key={item}
              label={CATEGORY_LABEL[item]}
              count={counts.get(item) ?? 0}
              image={CATEGORY_IMAGE[item]}
              delay={index * 55}
              priority={index < 2}
              onClick={() => chooseCategory(item)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {category !== "all" ? (
                <button
                  type="button"
                  onClick={() => chooseCategory("all")}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm font-semibold transition duration-300 hover:-translate-y-0.5 hover:border-foreground"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  모든 주제
                </button>
              ) : null}
              <p className="text-sm font-semibold">
                {category === "all" ? "검색 결과" : CATEGORY_LABEL[category]}
                <span className="ml-2 font-normal text-muted">{filtered.length}개</span>
              </p>
            </div>
            <SortSwitch sort={sort} onChange={setSort} />
          </div>

          {category !== "all" ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <TopicChip active={!topic} label="이 주제 전체" onClick={() => chooseTopic("")} />
              {topicsFor(category).map((item) => (
                <TopicChip
                  key={item.id}
                  active={topic === item.id}
                  label={item.label}
                  onClick={() => chooseTopic(item.id)}
                />
              ))}
            </div>
          ) : null}

          {sorted.showingRecentBecauseNoVotes ? (
            <p className="text-sm text-muted">아직 공유된 참여가 없어 최근 질문 순으로 보여 드립니다.</p>
          ) : null}

          {sorted.items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line bg-card px-5 py-8">
              <h3 className="text-lg font-bold">{query ? "검색 결과가 없습니다" : "이 주제의 질문이 아직 없습니다"}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">다른 주제나 검색어를 선택해 보세요.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sorted.items.map((question, index) => (
                <div
                  key={`${sort}-${question.id}`}
                  className="rise-in transition duration-300 hover:-translate-y-1"
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <QuestionCard question={question} mode={mode} voted={voted.has(question.id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CategoryCard({
  label,
  count,
  image,
  delay,
  priority,
  onClick,
}: {
  label: string;
  count: number;
  image: string;
  delay: number;
  priority: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rise-in group relative min-h-48 overflow-hidden rounded-3xl border border-line text-left shadow-[0_1px_0_rgba(28,25,23,0.04)] transition duration-500 hover:-translate-y-1.5 hover:shadow-[0_22px_50px_rgba(28,25,23,0.16)] sm:min-h-52"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Image
        src={image}
        alt=""
        fill
        sizes="(min-width: 640px) 480px, 100vw"
        priority={priority}
        className="object-cover transition duration-700 ease-out group-hover:scale-105"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/5 transition duration-500 group-hover:from-black/80" />
      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25 opacity-0 transition duration-700 group-hover:left-full group-hover:opacity-100" />
      <span className="relative flex h-full min-h-48 flex-col justify-end p-5 text-white sm:min-h-52">
        <span className="text-xs font-medium tracking-wide text-white/80">질문 {count}개</span>
        <span className="mt-1 flex items-end justify-between gap-3">
          <span className="text-2xl font-bold tracking-tight">{label}</span>
          <ArrowUpRight className="mb-1 h-5 w-5 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

function SortSwitch({ sort, onChange }: { sort: QuestionSort; onChange: (next: QuestionSort) => void }) {
  return (
    <div className="relative grid w-full max-w-xs grid-cols-2 rounded-full border border-line bg-card p-1 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:w-64">
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-foreground shadow-[0_8px_18px_rgba(28,25,23,0.18)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: sort === "latest" ? "translateX(100%)" : "translateX(0)" }}
      />
      <SortButton active={sort === "popular"} onClick={() => onChange("popular")} label="참여 많은 순" />
      <SortButton active={sort === "latest"} onClick={() => onChange("latest")} label="최신순" />
    </div>
  );
}

function SortButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative z-10 min-h-11 rounded-full px-3 text-sm font-semibold transition-colors duration-300 ${
        active ? "text-card" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function TopicChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition duration-300 hover:-translate-y-0.5 ${
        active ? "bg-foreground text-card shadow-[0_8px_18px_rgba(28,25,23,0.16)]" : "border border-line bg-card text-foreground"
      }`}
    >
      {label}
    </button>
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
