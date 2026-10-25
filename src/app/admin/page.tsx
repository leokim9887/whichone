import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminConsole, AdminLogin } from "@/components/admin-panel";
import { koreaDateKey } from "@/lib/daily";
import { loadAdmin } from "@/lib/data";

export const metadata: Metadata = {
  title: "운영",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={<div className="h-40 rounded-3xl bg-card" />}>
      <AdminScreen />
    </Suspense>
  );
}

async function AdminScreen() {
  await connection();
  const todayKey = koreaDateKey(new Date());
  const data = await loadAdmin();

  if (data.state === "unconfigured") {
    return (
      <div className="mx-auto max-w-2xl space-y-3 rounded-3xl border border-line bg-card p-6">
        <h1 className="text-2xl font-bold">운영 화면을 쓰려면 Supabase가 필요합니다</h1>
        <p className="text-sm leading-6 text-muted">
          환경 변수에 프로젝트 URL과 anon 키를 넣은 뒤, SQL로 관리자 UUID를 admin_users에 등록하세요. 관리자 비밀번호나
          서비스 롤 키는 브라우저에 넣지 않습니다.
        </p>
      </div>
    );
  }

  if (data.state === "unavailable") {
    return (
      <div className="rounded-3xl border border-danger/20 bg-card p-6" role="alert">
        <h1 className="text-2xl font-bold">운영 정보를 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-muted">연결을 확인한 뒤 다시 열어 주세요.</p>
      </div>
    );
  }

  if (data.state === "signed_out" || data.state === "anonymous") {
    return (
      <div className="space-y-4">
        {data.state === "anonymous" ? (
          <p className="text-sm text-muted">지금 연결된 계정은 익명 참여자입니다. 관리자 계정으로 다시 로그인하세요.</p>
        ) : null}
        <AdminLogin />
      </div>
    );
  }

  if (data.state === "forbidden") {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-danger/20 bg-card px-4 py-3 text-sm text-danger" role="alert">
          이 계정에는 관리자 권한이 없습니다.
        </p>
        <AdminLogin />
      </div>
    );
  }

  return <AdminConsole dashboard={data.dashboard} todayKey={todayKey} />;
}
