import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { QuestionCard } from "@/components/question-card";
import { CATEGORY_FILTERS, CATEGORY_LABEL, type CategoryFilter } from "@/lib/categories";
import { filterQuestions, latestQuestions, popularQuestions } from "@/lib/catalog";
import { formatKoreanDate } from "@/lib/daily";
import { formatParticipantCount } from "@/lib/format";
import type { HomeData } from "@/lib/data";

export function HomeView({
  data,
  category,
  query,
}: {
  data: HomeData;
  category: CategoryFilter;
  query: string;
}) {
  const filtered = filterQuestions(data.questions, category, query);
  const popular = popularQuestions(filtered);
  const latest = latestQuestions(filtered);
  const voted = new Set(data.votedIds);

  return (
    <div className="space-y-10">
      {data.mode === "demo" ? <DemoNotice /> : null}

      <section className="max-w-2xl">
        <p className="text-sm font-semibold text-accent">사람들의 선택으로 완성되는 질문</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-5xl sm:leading-tight">
          다른 사람들은 어떻게 생각할까?
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          가벼운 질문에 내 선택을 남기고, 전체 비율과 다른 사람의 이유를 확인해 보세요.
        </p>
      </section>

      {data.error ? (
        <div className="rounded-3xl border border-danger/20 bg-card px-5 py-4 text-sm leading-6 text-danger" role="alert">
          <p>{data.error}</p>
          <Link href="/" className="mt-2 inline-flex min-h-11 items-center font-semibold">
            다시 시도
          </Link>
        </div>
      ) : null}

      {!data.error && data.questions.length === 0 ? (
        <EmptyCopy
          title="아직 공개된 질문이 없습니다"
          body="데이터베이스에 시드 질문을 넣거나, 직접 질문을 제안해 보세요. 제안은 검토 후 공개됩니다."
        />
      ) : null}

      {data.today && !data.error ? (
        <section>
          <TodayCard
            id={data.today.id}
            title={data.today.title}
            category={CATEGORY_LABEL[data.today.category]}
            dateLabel={formatKoreanDate(data.dateKey)}
            countLabel={
              data.mode === "demo" ? "데모에서는 공유 집계를 보여 주지 않습니다" : formatParticipantCount(data.today.participantCount)
            }
          />
        </section>
      ) : null}

      {!data.error && data.questions.length > 0 ? (
        <>
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-xl font-bold">주제별 질문</h2>
              <SearchForm category={category} query={query} />
            </div>
            <CategoryLinks category={category} query={query} />
            {filtered.length === 0 ? (
              <EmptyCopy
                title={query ? "검색 결과가 없습니다" : "이 주제의 질문이 아직 없습니다"}
                body="다른 주제나 검색어를 선택해 보세요."
              />
            ) : (
              <>
                <QuestionSection
                  title="참여가 많은 질문"
                  note={
                    popular.showingRecentBecauseNoVotes
                      ? "아직 공유된 참여가 없어 최근 질문을 보여 드립니다."
                      : null
                  }
                  questions={popular.items}
                  mode={data.mode}
                  voted={voted}
                />
                <QuestionSection title="최신 질문" note={null} questions={latest} mode={data.mode} voted={voted} />
              </>
            )}
          </section>
        </>
      ) : null}

      <section className="rounded-3xl bg-foreground px-5 py-6 text-card sm:px-8">
        <h2 className="text-2xl font-bold">이런 질문, 다른 사람들은 뭐라고 할까?</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-card/80">
          떠오른 질문을 제안해 주세요. 검토가 끝난 질문만 공개되어 누구나 투표할 수 있습니다.
        </p>
        <Link
          href="/suggest"
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-card px-4 text-sm font-semibold text-foreground"
        >
          질문 제안하기
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

function DemoNotice() {
  return (
    <p className="rounded-2xl border border-warn/30 bg-[#fff7ed] px-4 py-3 text-sm leading-6 text-warn" role="status">
      로컬 데모 모드입니다. 질문 목록은 예시이고, 투표와 의견은 이 브라우저에만 저장됩니다. 다른 사람과 공유되는 결과가
      아닙니다.
    </p>
  );
}

function TodayCard({
  id,
  title,
  category,
  dateLabel,
  countLabel,
}: {
  id: string;
  title: string;
  category: string;
  dateLabel: string;
  countLabel: string;
}) {
  return (
    <article className="rounded-[28px] border border-line bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent-strong">오늘의 질문</span>
        <span className="text-muted">{dateLabel}</span>
        <span className="text-muted">{category}</span>
      </div>
      <h2 className="mt-4 text-2xl font-bold leading-snug sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm text-muted">{countLabel}</p>
      <Link
        href={`/questions/${id}`}
        className="mt-6 inline-flex min-h-11 items-center rounded-2xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong"
      >
        선택하러 가기
      </Link>
    </article>
  );
}

function SearchForm({ category, query }: { category: CategoryFilter; query: string }) {
  return (
    <form action="/" className="flex w-full gap-2 sm:max-w-sm">
      {category !== "all" ? <input type="hidden" name="category" value={category} /> : null}
      <label className="sr-only" htmlFor="question-search">
        질문 검색
      </label>
      <input
        id="question-search"
        name="q"
        key={query}
        defaultValue={query}
        placeholder="질문 검색"
        className="min-h-11 w-full rounded-2xl border border-line bg-card px-4 text-sm outline-none"
      />
      <button type="submit" className="min-h-11 shrink-0 rounded-2xl border border-line bg-card px-4 text-sm font-semibold">
        검색
      </button>
    </form>
  );
}

function CategoryLinks({ category, query }: { category: CategoryFilter; query: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {CATEGORY_FILTERS.map((item) => {
        const params = new URLSearchParams();
        if (item !== "all") {
          params.set("category", item);
        }
        if (query) {
          params.set("q", query);
        }
        const href = params.size > 0 ? `/?${params.toString()}` : "/";
        const active = item === category;
        return (
          <Link
            key={item}
            href={href}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold ${
              active ? "bg-foreground text-card" : "border border-line bg-card text-foreground"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item === "all" ? "전체" : CATEGORY_LABEL[item]}
          </Link>
        );
      })}
    </div>
  );
}

function QuestionSection({
  title,
  note,
  questions,
  mode,
  voted,
}: {
  title: string;
  note: string | null;
  questions: HomeData["questions"];
  mode: HomeData["mode"];
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

function EmptyCopy({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-card px-5 py-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}
