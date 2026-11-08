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
    size === "sm" ? "h-12 w-12" : size === "lg" ? "h-24 w-full sm:h-28" : "h-16 w-16 sm:h-20 sm:w-20";

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={`pressable relative shrink-0 overflow-hidden rounded-2xl border border-line bg-background ${dim}`}
        aria-label={`${alt} 크게 보기`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded option photos */}
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
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
    <div className="mb-3 flex gap-2 overflow-hidden">
      {withImages.slice(0, 4).map((option) => (
        <OptionImageThumb key={`${option.text}-${option.imageUrl}`} src={option.imageUrl!} alt={option.text} size="sm" />
      ))}
    </div>
  );
}
