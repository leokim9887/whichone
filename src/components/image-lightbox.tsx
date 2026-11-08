"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string | null;
  alt: string;
  onClose: () => void;
}) {
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

  if (!src) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="사진 크게 보기"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="pressable absolute right-4 top-[max(1rem,env(safe-area-inset-top))] inline-flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground shadow-lg"
        aria-label="닫기"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <div
        className="menu-pop max-h-[min(88dvh,56rem)] w-full max-w-3xl overflow-hidden rounded-[1.5rem] bg-card shadow-[0_24px_60px_rgba(28,25,23,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded option photos */}
        <img src={src} alt={alt} className="max-h-[min(88dvh,56rem)] w-full object-contain" />
      </div>
    </div>
  );
}
