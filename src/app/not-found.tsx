import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-3xl border border-line bg-card px-5 py-8">
      <h1 className="text-2xl font-bold">질문을 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm leading-6 text-muted">주소를 다시 확인해 주세요.</p>
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center font-semibold text-accent">
        메인으로 돌아가기
      </Link>
    </div>
  );
}
