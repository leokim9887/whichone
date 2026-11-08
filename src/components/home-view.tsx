import Link from "next/link";

import { ContentPolicyNotice } from "@/components/content-policy-notice";
import { HomeBrowser } from "@/components/home-browser";
import { SuggestCta } from "@/components/suggest-cta";
import { TodayCarousel } from "@/components/today-carousel";
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
    <div className="space-y-8 sm:space-y-11">
      {data.mode === "demo" ? <DemoNotice /> : null}

      <section className="rise-in relative max-w-2xl overflow-hidden rounded-[1.75rem] border border-line/80 bg-card/70 px-5 py-6 shadow-[0_12px_40px_rgba(28,25,23,0.04)] sm:px-8 sm:py-8">
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-[#f59e0b]/10 blur-3xl"
          aria-hidden="true"
        />
        <p className="relative text-sm font-semibold text-accent">사람들의 선택으로 완성되는 질문</p>
        <h1 className="relative mt-2 text-[1.75rem] font-bold tracking-tight text-foreground leading-tight sm:text-5xl sm:leading-tight">
          다른 사람들은
          <br className="hidden sm:block" /> 어떻게 생각할까?
        </h1>
        <p className="relative mt-3 max-w-xl text-sm leading-7 text-muted sm:mt-4 sm:text-base">
          가벼운 질문에 내 선택을 남기고, 전체 비율과 다른 사람의 이유를 확인해 보세요.
        </p>
      </section>

      <div className="rise-in" style={{ animationDelay: "80ms" }}>
        <ContentPolicyNotice />
      </div>

      {data.error ? (
        <div
          className="rise-in rounded-[1.75rem] border border-danger/20 bg-card px-5 py-4 text-sm leading-6 text-danger"
          role="alert"
        >
          <p>{data.error}</p>
          <Link href="/" className="mt-2 inline-flex min-h-11 items-center font-semibold">
            다시 시도
          </Link>
        </div>
      ) : null}

      {!data.error && data.questions.length === 0 ? (
        <EmptyCopy
          title="아직 공개된 질문이 없습니다"
          body="데이터베이스에 시드 질문을 넣거나, 직접 질문을 올려 보세요. 프로필을 설정한 뒤에는 바로 공개됩니다."
        />
      ) : null}

      {data.today.length > 0 && !data.error ? (
        <div className="rise-in" style={{ animationDelay: "120ms" }}>
          <TodayCarousel
            dateLabel={formatKoreanDate(data.dateKey)}
            slides={data.today.map((question) => ({
              id: question.id,
              title: question.title,
              category: categoryTopicLabel(question.category, question.topic),
              countLabel:
                data.mode === "demo"
                  ? "데모에서는 공유 집계를 보여 주지 않습니다"
                  : formatParticipantCount(question.participantCount),
            }))}
          />
        </div>
      ) : null}

      {!data.error && data.questions.length > 0 ? (
        <div className="rise-in" style={{ animationDelay: "160ms" }}>
          <HomeBrowser
            questions={data.questions}
            votedIds={data.votedIds}
            mode={data.mode}
            initialCategory={category}
            initialTopic={topic}
            initialQuery={query}
          />
        </div>
      ) : null}

      <div className="rise-in" style={{ animationDelay: "200ms" }}>
        <SuggestCta />
      </div>
    </div>
  );
}

function DemoNotice() {
  return (
    <p
      className="rise-in rounded-2xl border border-warn/30 bg-[#fff7ed] px-4 py-3 text-sm leading-6 text-warn"
      role="status"
    >
      로컬 데모 모드입니다. 질문 목록은 예시이고, 투표와 의견은 이 브라우저에만 저장됩니다. 다른 사람과 공유되는 결과가
      아닙니다.
    </p>
  );
}

function EmptyCopy({ title, body }: { title: string; body: string }) {
  return (
    <div className="rise-in rounded-[1.75rem] border border-dashed border-line bg-card/80 px-5 py-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}
