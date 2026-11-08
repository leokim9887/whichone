"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

const SHOW_OFFSET = 120;

export function ScrollEdges() {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  useEffect(() => {
    function update() {
      const scrollY = window.scrollY;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const scrollable = maxScroll > SHOW_OFFSET;
      setShowTop(scrollable && scrollY > SHOW_OFFSET);
      setShowBottom(scrollable && scrollY < maxScroll - SHOW_OFFSET);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scrollToBottom() {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }

  if (!showTop && !showBottom) {
    return null;
  }

  return (
    <div
      className="scroll-edges pointer-events-none fixed right-3.5 z-40 flex flex-col gap-2.5 sm:right-6"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      aria-label="페이지 이동"
    >
      {showTop ? (
        <button
          type="button"
          onClick={scrollToTop}
          className="scroll-edge-btn pointer-events-auto"
          aria-label="맨 위로 이동"
        >
          <ChevronUp className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        </button>
      ) : null}
      {showBottom ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className="scroll-edge-btn pointer-events-auto"
          aria-label="맨 아래로 이동"
        >
          <ChevronDown className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
