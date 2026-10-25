import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-8 text-sm leading-6 text-muted sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold text-foreground">WhicHOne</p>
          <p>로그인 없이 익명으로 참여하는 선택 투표입니다.</p>
          <p>의견에 개인정보를 적지 말아 주세요. 부적절한 내용은 신고할 수 있습니다.</p>
        </div>
        <div className="flex gap-4 font-semibold">
          <Link href="/suggest" className="hover:text-foreground">
            질문 제안
          </Link>
          <Link href="/admin" className="hover:text-foreground">
            운영
          </Link>
        </div>
      </div>
    </footer>
  );
}
