import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-4 border-t border-line/80">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-sm leading-6 text-muted sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl space-y-1.5">
          <p className="font-semibold text-foreground">
            Whic<span className="text-accent">H</span>One
          </p>
          <p>닉네임으로 가볍게 투표하고, 댓글로 생각을 나눠 보세요.</p>
          <p>개인정보는 적지 말아 주세요. 부적절한 내용은 신고할 수 있습니다.</p>
        </div>
        <div className="flex gap-4 font-semibold">
          <Link href="/admin" className="text-xs font-medium text-line transition hover:text-muted" aria-label="운영">
            운영
          </Link>
        </div>
      </div>
    </footer>
  );
}
