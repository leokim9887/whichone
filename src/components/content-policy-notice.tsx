export function ContentPolicyNotice() {
  return (
    <aside
      className="content-policy-notice relative overflow-hidden rounded-2xl border border-[#f0d7a8] bg-[#fff8ee] px-4 py-3 sm:px-5"
      role="note"
      aria-label="콘텐츠 이용 안내"
    >
      <span className="content-policy-glow" aria-hidden="true" />
      <div className="relative flex gap-3">
        <span
          className="content-policy-icon mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#efd2a0] bg-[#fff1d6] text-[#9a6700]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4" strokeLinecap="round" />
            <path d="M12 17h.01" strokeLinecap="round" />
            <path
              d="M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#7a4e00]">콘텐츠 이용 안내</p>
          <p className="mt-1 text-sm leading-6 text-[#8a5a14]">
            지나치게 정치적이거나 선정·폭력적인 주제와 표현은 검토 후 비공개되거나 삭제될 수 있습니다. 서로 존중하는
            질문과 의견을 남겨 주세요.
          </p>
        </div>
      </div>
    </aside>
  );
}
