"use client";

export function QuestionImageGallery({
  urls,
  alt,
  size = "detail",
}: {
  urls: string[];
  alt: string;
  size?: "card" | "detail";
}) {
  if (urls.length === 0) {
    return null;
  }

  if (size === "card") {
    return (
      <div className="mb-3 overflow-hidden rounded-2xl bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded question photos */}
        <img src={urls[0]} alt={alt} className="aspect-[16/10] w-full object-cover" loading="lazy" />
        {urls.length > 1 ? (
          <p className="px-3 py-1.5 text-xs font-semibold text-muted">사진 {urls.length}장</p>
        ) : null}
      </div>
    );
  }

  if (urls.length === 1) {
    return (
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded question photos */}
        <img src={urls[0]} alt={alt} className="max-h-[28rem] w-full object-cover" />
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:gap-3">
      {urls.map((url, index) => (
        <li
          key={`${url}-${index}`}
          className={`overflow-hidden rounded-2xl border border-line bg-card ${
            urls.length === 3 && index === 0 ? "col-span-2" : ""
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded question photos */}
          <img
            src={url}
            alt={`${alt} ${index + 1}`}
            className="aspect-[4/3] w-full object-cover"
            loading="lazy"
          />
        </li>
      ))}
    </ul>
  );
}
