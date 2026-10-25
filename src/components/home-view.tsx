import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HomeBrowser } from "@/components/home-browser";
import { formatKoreanDate } from "@/lib/daily";
import { formatParticipantCount } from "@/lib/format";
import { categoryTopicLabel } from "@/lib/topics";
import type { HomeData } from "@/lib/data";
import type { CategoryFilter } from "@/lib/categories";

export function HomeView({
  data,
  category,
  topic,
  query,
}: {
  data: HomeData;
  category: CategoryFilter;
  topic: string;
  query: string;
}) {
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
            category={categoryTopicLabel(data.today.category, data.today.topic)}
            dateLabel={formatKoreanDate(data.dateKey)}
            countLabel={
              data.mode === "demo" ? "데모에서는 공유 집계를 보여 주지 않습니다" : formatParticipantCount(data.today.participantCount)
            }
          />
        </section>
      ) : null}

      {!data.error && data.questions.length > 0 ? (
        <HomeBrowser
          questions={data.questions}
          votedIds={data.votedIds}
          mode={data.mode}
          initialCategory={category}
          initialTopic={topic}
          initialQuery={query}
        />
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

function EmptyCopy({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-card px-5 py-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}
