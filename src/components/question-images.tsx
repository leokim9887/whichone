"use client";

import { useState } from "react";

import { ImageLightbox } from "@/components/image-lightbox";

export function OptionImageThumb({
  src,
  alt,
  size = "md",
}: {
  src: string;
  alt: string;
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const dim =
    size === "sm"
      ? "h-12 w-12"
      : size === "lg"
        ? "h-24 w-full sm:h-28"
        : "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]";

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={`pressable relative shrink-0 overflow-hidden rounded-2xl border border-line bg-background shadow-[0_1px_0_rgba(28,25,23,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-[0_10px_24px_rgba(28,25,23,0.1)] ${dim}`}
        aria-label={`${alt} 크게 보기`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded option photos */}
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
      </button>
      <ImageLightbox src={open ? src : null} alt={alt} onClose={() => setOpen(false)} />
    </>
  );
}

export function QuestionOptionImageStrip({
  options,
}: {
  options: { text: string; imageUrl: string | null }[];
}) {
  const withImages = options.filter((option) => option.imageUrl);
  if (withImages.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-0.5">
      {withImages.slice(0, 4).map((option) => (
        <OptionImageThumb key={`${option.text}-${option.imageUrl}`} src={option.imageUrl!} alt={option.text} size="sm" />
      ))}
    </div>
  );
}
