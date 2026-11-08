"use client";

import { X } from "lucide-react";
import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string | null;
  alt: string;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!src) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [src, onClose]);

  if (!src || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-3 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <p id={titleId} className="sr-only">
        {alt ? `${alt} 크게 보기` : "사진 크게 보기"}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="pressable absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.28)]"
        aria-label="닫기"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <div
        className="flex max-h-[min(92dvh,56rem)] max-w-[min(96vw,56rem)] items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded option photos */}
        <img
          src={src}
          alt={alt}
          className="max-h-[min(92dvh,56rem)] max-w-[min(96vw,56rem)] rounded-2xl object-contain shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        />
      </div>
    </div>,
    document.body,
  );
}
