"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

const AUTO_MS = 5000;

export type TodaySlide = {
  id: string;
  title: string;
  category: string;
  countLabel: string;
};

export function TodayCarousel({ slides, dateLabel }: { slides: TodaySlide[]; dateLabel: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const startX = useRef<number | null>(null);
  const safeIndex = slides.length === 0 ? 0 : index % slides.length;

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  function go(next: number) {
    if (slides.length === 0) {
      return;
    }
    setIndex((next + slides.length) % slides.length);
  }

  if (slides.length === 0) {
    return null;
  }

  const slide = slides[safeIndex];

  return (
    <section
      aria-roledescription="캐러셀"
      aria-label="오늘의 질문"
      className="rounded-[28px] border border-line bg-card p-5 sm:p-7"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false);
        }
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
          return;
        }
        startX.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (startX.current === null) {
          return;
        }
        const delta = event.clientX - startX.current;
        startX.current = null;
        if (delta > 48) {
          go(safeIndex - 1);
        } else if (delta < -48) {
          go(safeIndex + 1);
        }
      }}
      onPointerCancel={() => {
        startX.current = null;
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent-strong">오늘의 질문</span>
          <span className="text-muted">{dateLabel}</span>
          <span className="text-muted">{slide.category}</span>
        </div>
        {slides.length > 1 ? (
          <div className="flex shrink-0 gap-1">
            <CarouselButton label="이전 질문" onClick={() => go(safeIndex - 1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </CarouselButton>
            <CarouselButton label="다음 질문" onClick={() => go(safeIndex + 1)}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </CarouselButton>
          </div>
        ) : null}
      </div>
      <h2 className="mt-4 min-h-16 text-2xl font-bold leading-snug sm:min-h-20 sm:text-3xl">{slide.title}</h2>
      <p className="mt-3 text-sm text-muted">{slide.countLabel}</p>
      <Link
        href={`/questions/${slide.id}`}
        className="mt-6 inline-flex min-h-11 items-center rounded-2xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong"
      >
        선택하러 가기
      </Link>
      {slides.length > 1 ? (
        <div className="mt-6 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <div
              key={safeIndex}
              className="today-progress h-full rounded-full bg-accent"
              style={{ animationDuration: `${AUTO_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
              onAnimationEnd={() => {
                if (!pausedRef.current && !document.hidden) {
                  go(safeIndex + 1);
                }
              }}
            />
          </div>
          <div className="flex gap-1.5" role="tablist" aria-label="오늘의 질문 목록">
            {slides.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={itemIndex === safeIndex}
                aria-label={item.category}
                onClick={() => go(itemIndex)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  itemIndex === safeIndex ? "w-6 bg-foreground" : "w-2.5 bg-line hover:bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CarouselButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-background transition duration-300 hover:-translate-y-0.5 hover:border-foreground"
    >
      {children}
    </button>
  );
}
