import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-8 text-sm leading-6 text-muted sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl space-y-1">
          <p className="font-semibold text-foreground">WhicHOne</p>
          <p>닉네임으로 익명 투표하고, 댓글·답글로 생각을 나눕니다.</p>
          <p>개인정보는 적지 말아 주세요. 부적절한 내용은 신고할 수 있습니다.</p>
        </div>
        <div className="flex gap-4 font-semibold">
          <Link
            href="/admin"
            className="text-xs font-medium text-line hover:text-muted"
            aria-label="운영"
          >
            운영
          </Link>
        </div>
      </div>
    </footer>
  );
}
