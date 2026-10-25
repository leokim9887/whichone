import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { QuestionCard } from "@/components/question-card";
import { QuestionInteractive } from "@/components/question-interactive";
import { QuestionSkeleton } from "@/components/skeletons";
import { loadQuestion, loadQuestionMetadata } from "@/lib/data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meta = await loadQuestionMetadata(id);
  if (!meta) {
    return { title: "질문" };
  }
  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
    },
  };
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<QuestionSkeleton />}>
      <QuestionScreen params={params} />
    </Suspense>
  );
}

async function QuestionScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadQuestion(id);

  if (data.state === "missing") {
    notFound();
  }

  if (data.state === "unpublished") {
    return (
      <div className="rounded-3xl border border-line bg-card px-5 py-8">
        <h1 className="text-2xl font-bold">아직 공개되지 않은 질문입니다</h1>
        <p className="mt-2 text-sm leading-6 text-muted">검토가 끝나기 전에는 선택지를 볼 수 없습니다.</p>
        <Link href="/" className="mt-4 inline-flex min-h-11 items-center font-semibold text-accent">
          다른 질문 보기
        </Link>
      </div>
    );
  }

  if (data.state === "unavailable") {
    return (
      <div className="rounded-3xl border border-danger/20 bg-card px-5 py-8" role="alert">
        <h1 className="text-2xl font-bold">질문을 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm leading-6 text-muted">네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>
        <Link href={`/questions/${id}`} className="mt-4 inline-flex min-h-11 items-center font-semibold text-accent">
          다시 시도
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <QuestionInteractive
        mode={data.mode}
        question={data.question}
        initialParticipation={data.participation}
        initialComments={data.comments}
        participationError={data.participationError}
      />
      {data.related.length > 0 ? (
        <section>
          <h2 className="text-xl font-bold">같은 주제의 다른 질문</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {data.related.map((question) => (
              <QuestionCard key={question.id} question={question} mode={data.mode} voted={false} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
