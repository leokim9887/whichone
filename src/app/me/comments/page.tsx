import type { Metadata } from "next";
import { Suspense } from "react";

import { MyCommentsView } from "@/components/my-comments-view";
import { loadMyComments } from "@/lib/data";

export const metadata: Metadata = {
  title: "내가 쓴 댓글",
  description: "내가 남긴 댓글과 답글을 확인합니다.",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 max-w-2xl rounded-3xl bg-card" />}>
      <Screen />
    </Suspense>
  );
}

async function Screen() {
  const data = await loadMyComments();
  return <MyCommentsView mode={data.mode} initialItems={data.items} error={data.error} />;
}
