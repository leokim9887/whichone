"use client";

import { ArrowLeft, ArrowUpRight, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";

import { QuestionCard } from "@/components/question-card";
import { CATEGORY_LABEL, isCategoryFilter, type CategoryFilter } from "@/lib/categories";
import { filterQuestions, sortQuestions, type QuestionSort } from "@/lib/catalog";
import { LIMITS } from "@/lib/limits";
import { CATEGORIES, type Category, type DataMode, type Question } from "@/lib/types";

const CATEGORY_IMAGE: Record<Category, string> = {
  daily: "/categories/daily.jpg",
  love: "/categories/love-hands.jpg",
  money: "/categories/money.jpg",
  work: "/categories/work-office.jpg",
  food: "/categories/food.jpg",
  values: "/categories/values.jpg",
  sports: "/categories/sports.jpg",
};

const CATEGORY_IMAGE_POSITION: Partial<Record<Category, string>> = {
  sports: "object-center",
};

export function HomeBrowser({
  questions,
  votedIds,
  mode,
  initialCategory,
  initialQuery,
}: {
  questions: Question[];
  votedIds: string[];
  mode: DataMode;
  initialCategory: CategoryFilter;
  initialQuery: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [sort, setSort] = useState<QuestionSort>("popular");
  const [, startTransition] = useTransition();
  const voted = useMemo(() => new Set(votedIds), [votedIds]);
  const counts = useMemo(() => {
    const tally = new Map<Category, number>();
    for (const question of questions) {
      tally.set(question.category, (tally.get(question.category) ?? 0) + 1);
    }
    return tally;
  }, [questions]);
  const filtered = useMemo(
    () => filterQuestions(questions, category, query),
    [questions, category, query],
  );
  const sorted = useMemo(() => sortQuestions(filtered, sort), [filtered, sort]);
  const browsingCategories = category === "all" && query.trim().length === 0;

  useEffect(() => {
    function onPopState() {
      const next = readFilters(window.location.search);
      setCategory(next.category);
      setQuery(next.query);
      setDraftQuery(next.query);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function chooseCategory(next: CategoryFilter) {
    setCategory(next);
    writeFilters(next, query, true);
  }

  function applySearch(raw: string) {
    const value = raw.slice(0, LIMITS.search);
    const applied = value.trim();
    setDraftQuery(value);
    startTransition(() => {
      setQuery(applied);
      writeFilters(category, applied, false);
    });
  }

  function clearSearch() {
    setDraftQuery("");
    startTransition(() => {
      setQuery("");
      writeFilters(category, "", false);
    });
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">주제별 질문</h2>
          <p className="mt-1 text-sm text-muted">주제를 고르면 그 안의 질문이 열립니다.</p>
        </div>
        <form
          className="flex w-full gap-2 sm:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
            applySearch(draftQuery);
          }}
        >
          <label className="sr-only" htmlFor="question-search">
            질문 검색
          </label>
          <div className="relative min-w-0 flex-1">
            <input
              id="question-search"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value.slice(0, LIMITS.search))}
              placeholder="궁금한 질문을 찾아보세요"
              maxLength={LIMITS.search}
              className="min-h-11 w-full rounded-2xl border border-line bg-card/90 py-2 pr-10 pl-4 text-sm outline-none transition duration-300 focus:border-accent"
            />
            {draftQuery ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-background hover:text-foreground"
                aria-label="검색어 지우기"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            className="pressable min-h-11 shrink-0 rounded-2xl border border-line bg-card px-4 text-sm font-semibold hover:border-foreground/30"
          >
            검색
          </button>
        </form>
      </div>

      {browsingCategories ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((item, index) => (
            <CategoryCard
              key={item}
              label={CATEGORY_LABEL[item]}
              count={counts.get(item) ?? 0}
              image={CATEGORY_IMAGE[item]}
              imageClassName={CATEGORY_IMAGE_POSITION[item]}
              delay={index * 55}
              priority={index < 4}
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
            {filtered.length > 0 ? <SortSwitch sort={sort} onChange={setSort} /> : null}
          </div>

          {sorted.showingRecentBecauseNoVotes ? (
            <p className="text-sm text-muted">아직 공유된 참여가 없어 최근 질문 순으로 보여 드립니다.</p>
          ) : null}

          {sorted.items.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-line bg-card/80 px-5 py-8">
              <h3 className="text-lg font-bold">{query ? "검색 결과가 없습니다" : "이 주제의 질문이 아직 없습니다"}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">다른 주제나 검색어를 선택해 보세요.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sorted.items.map((question, index) => (
                <div
                  key={`${sort}-${question.id}`}
                  className="rise-in"
                  style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
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
  imageClassName,
  delay,
  priority,
  onClick,
}: {
  label: string;
  count: number;
  image: string;
  imageClassName?: string;
  delay: number;
  priority: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rise-in group relative min-h-40 overflow-hidden rounded-3xl border border-line text-left shadow-[0_1px_0_rgba(28,25,23,0.04)] transition duration-500 active:scale-[0.99] hover:-translate-y-1.5 hover:shadow-[0_22px_50px_rgba(28,25,23,0.16)] sm:min-h-48 lg:min-h-52"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Image
        src={image}
        alt=""
        fill
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        priority={priority}
        className={`object-cover transition duration-700 ease-out group-hover:scale-105 ${imageClassName ?? ""}`}
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/5 transition duration-500 group-hover:from-black/80" />
      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25 opacity-0 transition duration-700 group-hover:left-full group-hover:opacity-100" />
      <span className="relative flex h-full min-h-40 flex-col justify-end p-4 text-white sm:min-h-48 sm:p-5 lg:min-h-52">
        <span className="text-xs font-medium tracking-wide text-white/80">질문 {count}개</span>
        <span className="mt-1 flex items-end justify-between gap-3">
          <span className="text-xl font-bold tracking-tight sm:text-2xl">{label}</span>
          <ArrowUpRight className="mb-1 h-5 w-5 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

function SortSwitch({ sort, onChange }: { sort: QuestionSort; onChange: (next: QuestionSort) => void }) {
  return (
    <div className="relative grid w-full grid-cols-2 rounded-full border border-line bg-card p-1 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:w-64 sm:max-w-xs">
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

function readFilters(search: string): { category: CategoryFilter; query: string } {
  const params = new URLSearchParams(search);
  const rawCategory = params.get("category") ?? "";
  const category = isCategoryFilter(rawCategory) ? rawCategory : "all";
  const query = (params.get("q") ?? "").trim().slice(0, LIMITS.search);
  return { category, query };
}

function writeFilters(category: CategoryFilter, query: string, push: boolean) {
  const params = new URLSearchParams();
  if (category !== "all") {
    params.set("category", category);
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
