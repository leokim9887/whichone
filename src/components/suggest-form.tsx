"use client";

import { ImagePlus, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";

import { useProfile } from "@/components/profile-provider";
import { categoryLabel } from "@/lib/categories";
import { addDemoSuggestion, checkDemoQuestionDuplicate } from "@/lib/demo-state";
import { readDemoState, writeDemoState } from "@/lib/demo-storage";
import { LIMITS } from "@/lib/limits";
import { messageForCode } from "@/lib/messages";
import { canWriteQuestionToday, invalidateWriteQuotaCache, setCachedWriteQuota } from "@/lib/suggest-quota";
import { topicsFor, type Topic } from "@/lib/topics";
import { CATEGORIES, type Category, type DataMode } from "@/lib/types";
import { validateOptionImage, validateSuggestion } from "@/lib/validation";
import {
  checkQuestionDuplicateAction,
  submitSuggestionAction,
  type FieldErrors,
} from "@/server/actions";

const SUGGEST_RESET_KEY = "whichone:suggest-reset";

type ImageDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

function consumeSuggestResetKey(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    if (sessionStorage.getItem(SUGGEST_RESET_KEY) === "1") {
      sessionStorage.removeItem(SUGGEST_RESET_KEY);
      return `reset-${Date.now()}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function SuggestForm({ mode }: { mode: DataMode }) {
  const [instanceKey, setInstanceKey] = useState("default");
  const resetKey = consumeSuggestResetKey();
  if (resetKey && resetKey !== instanceKey) {
    setInstanceKey(resetKey);
  }
  return <SuggestFormFields key={instanceKey} mode={mode} />;
}

function SuggestFormFields({ mode }: { mode: DataMode }) {
  const router = useRouter();
  const baseId = useId();
  const { ensureProfile, openSetup } = useProfile();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [optionImages, setOptionImages] = useState<(ImageDraft | null)[]>([null, null]);
  const [company, setCompany] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dupTitle, setDupTitle] = useState(false);
  const [dupDescription, setDupDescription] = useState(false);
  const [dupChecking, setDupChecking] = useState(false);
  const checkSeq = useRef(0);

  useEffect(() => {
    const titleValue = title.trim();
    const descriptionValue = description.trim();
    if (!titleValue && !descriptionValue) {
      return;
    }

    let cancelled = false;
    const seq = ++checkSeq.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled || seq !== checkSeq.current) {
          return;
        }
        setDupChecking(true);
        if (mode === "demo") {
          const result = checkDemoQuestionDuplicate(readDemoState(), titleValue, descriptionValue);
          if (!cancelled && seq === checkSeq.current) {
            setDupTitle(result.titleTaken);
            setDupDescription(result.descriptionTaken);
            setDupChecking(false);
          }
          return;
        }
        const result = await checkQuestionDuplicateAction(titleValue, descriptionValue);
        if (cancelled || seq !== checkSeq.current) {
          return;
        }
        if (!result.ok) {
          setDupTitle(false);
          setDupDescription(false);
          setDupChecking(false);
          return;
        }
        setDupTitle(result.titleTaken);
        setDupDescription(result.descriptionTaken);
        setDupChecking(false);
      })();
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [title, description, mode]);

  function revokeImage(item: ImageDraft | null) {
    if (item) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }

  function resetForm() {
    for (const item of optionImages) {
      revokeImage(item);
    }
    setTitle("");
    setDescription("");
    setCategory("");
    setTopic("");
    setOptions(["", ""]);
    setOptionImages([null, null]);
    setCompany("");
    setErrors({});
    setMessage(null);
    setPending(false);
    setDupTitle(false);
    setDupDescription(false);
  }

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, optionIndex) => (optionIndex === index ? value : option)));
  }

  function addOption() {
    setOptions((current) => [...current, ""]);
    setOptionImages((current) => [...current, null]);
  }

  function removeOption(index: number) {
    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
    setOptionImages((current) => {
      revokeImage(current[index] ?? null);
      return current.filter((_, optionIndex) => optionIndex !== index);
    });
  }

  function setOptionImage(index: number, fileList: FileList | null) {
    const file = fileList?.[0] ?? null;
    const checked = validateOptionImage(file);
    if (!checked.ok) {
      setErrors((current) => ({ ...current, [`optionImage-${index}`]: checked.errors.images ?? checked.message }));
      return;
    }
    setErrors((current) => {
      const next = { ...current };
      delete next[`optionImage-${index}`];
      delete next.images;
      return next;
    });
    setOptionImages((current) =>
      current.map((item, optionIndex) => {
        if (optionIndex !== index) {
          return item;
        }
        revokeImage(item);
        if (!checked.value.file) {
          return null;
        }
        return {
          id: `${checked.value.file.name}-${checked.value.file.size}-${crypto.randomUUID()}`,
          file: checked.value.file,
          previewUrl: URL.createObjectURL(checked.value.file),
        };
      }),
    );
  }

  function clearOptionImage(index: number) {
    setOptionImages((current) =>
      current.map((item, optionIndex) => {
        if (optionIndex !== index) {
          return item;
        }
        revokeImage(item);
        return null;
      }),
    );
  }

  function notifyRateLimited() {
    const text = messageForCode("rate_limited");
    setCachedWriteQuota(false, LIMITS.suggestionsPerDay, LIMITS.suggestionsPerDay);
    window.alert(text);
    setMessage(text);
  }

  function goHomeClean() {
    try {
      sessionStorage.setItem(SUGGEST_RESET_KEY, "1");
      sessionStorage.setItem("whichone:my-questions-dirty", "1");
    } catch {
      // ignore storage failures
    }
    invalidateWriteQuotaCache();
    void canWriteQuestionToday({ force: true });
    flushSync(() => {
      resetForm();
    });
    router.replace("/");
    router.refresh();
  }

  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function submit() {
    setMessage(null);
    const validated = validateSuggestion({ title, description, category, topic, options });
    if (!validated.ok) {
      setErrors(validated.errors);
      return;
    }
    for (const [index, image] of optionImages.entries()) {
      const checked = validateOptionImage(image?.file ?? null);
      if (!checked.ok) {
        setErrors((current) => ({
          ...current,
          [`optionImage-${index}`]: checked.errors.images ?? checked.message,
        }));
        return;
      }
    }
    if (dupTitle || dupDescription) {
      setErrors({
        ...(dupTitle ? { title: messageForCode("duplicate_title") } : {}),
        ...(dupDescription ? { description: messageForCode("duplicate_description") } : {}),
      });
      setMessage(messageForCode("duplicate"));
      return;
    }
    const ready = await ensureProfile();
    if (!ready) {
      setMessage(messageForCode("profile_required"));
      return;
    }
    setErrors({});
    setPending(true);

    if (mode === "demo") {
      const optionImageUrls: (string | null)[] = [];
      for (const image of optionImages.slice(0, validated.value.options.length)) {
        optionImageUrls.push(image ? await fileToDataUrl(image.file) : null);
      }
      const result = addDemoSuggestion(readDemoState(), { ...validated.value, optionImageUrls });
      if (!result.ok) {
        setPending(false);
        if (result.code === "rate_limited") {
          notifyRateLimited();
          return;
        }
        if (result.code === "duplicate_title" || result.code === "duplicate_description") {
          setMessage(messageForCode(result.code));
          setErrors({
            ...(result.code === "duplicate_title" ? { title: messageForCode(result.code) } : {}),
            ...(result.code === "duplicate_description" ? { description: messageForCode(result.code) } : {}),
          });
          return;
        }
        setMessage(messageForCode(result.code));
        return;
      }
      writeDemoState(result.state);
      goHomeClean();
      return;
    }

    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description);
    formData.set("category", category);
    formData.set("topic", topic);
    formData.set("company", company);
    validated.value.options.forEach((option, index) => {
      formData.append("options", option);
      const image = optionImages[index];
      if (image) {
        formData.append(`optionImage-${index}`, image.file);
      }
    });

    const result = await submitSuggestionAction(formData);
    if (!result.ok) {
      setPending(false);
      if (result.code === "profile_required") {
        openSetup();
      }
      if (result.code === "rate_limited") {
        notifyRateLimited();
        return;
      }
      if (result.code === "duplicate_title" || result.code === "duplicate_description" || result.code === "duplicate") {
        setDupTitle(result.code === "duplicate_title" || result.code === "duplicate");
        setDupDescription(result.code === "duplicate_description" || result.code === "duplicate");
      }
      setErrors(result.errors ?? {});
      setMessage(result.message);
      return;
    }
    goHomeClean();
  }

  function chooseCategory(next: string) {
    setCategory(next);
    setTopic("");
  }

  function chooseTopic(next: Topic) {
    setTopic(next.id);
  }

  const topicChoices = isCategoryValue(category) ? topicsFor(category) : [];
  const blocked = pending || dupTitle || dupDescription || dupChecking;

  return (
    <form
      className="surface-panel overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-7 p-5 sm:p-8">
        <section className="space-y-3">
          <SectionLabel title="어떤 질문인가요?" hint="한눈에 읽히는 짧은 문장이 좋아요." />
          <Field label="질문 제목" error={errors.title || (dupTitle ? messageForCode("duplicate_title") : undefined)} required>
            <input
              value={title}
              onChange={(event) => {
                const next = event.target.value;
                setTitle(next);
                if (!next.trim()) {
                  setDupTitle(false);
                  if (!description.trim()) {
                    setDupDescription(false);
                    setDupChecking(false);
                  }
                }
              }}
              maxLength={LIMITS.title}
              required
              placeholder="예: 주말에 친구 약속이 생기면?"
              className={inputClass}
            />
          </Field>
          <p className="text-right text-xs text-muted">
            {title.length}/{LIMITS.title}
          </p>
        </section>

        <section className="space-y-3">
          <SectionLabel title="주제를 골라 주세요" hint="비슷한 질문을 찾는 데 도움이 됩니다." />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((item) => {
              const active = category === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseCategory(item)}
                  className={`inline-flex min-h-11 items-center justify-center rounded-2xl px-3 text-sm font-semibold transition ${
                    active
                      ? "bg-foreground text-card shadow-[0_10px_22px_rgba(28,25,23,0.14)]"
                      : "border border-line bg-background text-foreground hover:border-foreground/30"
                  }`}
                >
                  {categoryLabel(item)}
                </button>
              );
            })}
          </div>
          {errors.category ? <p className="text-sm text-danger">{errors.category}</p> : null}

          {topicChoices.length > 0 ? (
            <div className="space-y-2 pt-1">
              <p className="text-sm font-semibold text-muted">세부 주제</p>
              <div className="flex flex-wrap gap-2">
                {topicChoices.map((item) => {
                  const active = topic === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => chooseTopic(item)}
                      className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-semibold transition ${
                        active
                          ? "bg-accent text-white"
                          : "border border-line bg-background text-foreground hover:border-accent/40"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              {errors.topic ? <p className="text-sm text-danger">{errors.topic}</p> : null}
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <SectionLabel title="조금만 더 설명해 주세요" hint="필수는 아니에요. 상황을 덧붙이면 투표가 쉬워집니다." />
          <Field
            label="설명"
            error={errors.description || (dupDescription ? messageForCode("duplicate_description") : undefined)}
          >
            <textarea
              value={description}
              onChange={(event) => {
                const next = event.target.value;
                setDescription(next);
                if (!next.trim()) {
                  setDupDescription(false);
                  if (!title.trim()) {
                    setDupTitle(false);
                    setDupChecking(false);
                  }
                }
              }}
              maxLength={LIMITS.description}
              rows={3}
              placeholder="왜 이 질문이 궁금한지, 어떤 상황에서 고민했는지 적어 보세요."
              className={inputClass}
            />
          </Field>
          <p className="text-right text-xs text-muted">
            {description.length}/{LIMITS.description}
          </p>
        </section>

        <section className="space-y-3">
          <SectionLabel
            title="선택지를 만들어 주세요"
            hint="2~4개. 각 선택지에 사진 1장을 넣을 수 있어요. 사진은 선택 사항입니다."
          />
          {errors.options ? (
            <p className="text-sm text-danger" role="alert">
              {errors.options}
            </p>
          ) : null}
          <div className="space-y-3">
            {options.map((option, index) => {
              const image = optionImages[index] ?? null;
              const inputId = `${baseId}-option-image-${index}`;
              return (
                <div key={index} className="rounded-3xl border border-line bg-background/70 p-3 sm:p-4">
                  <div className="flex items-start gap-2">
                    <span className="mt-2.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-strong">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <label className="sr-only" htmlFor={`option-${index}`}>
                        선택지 {index + 1}
                      </label>
                      <input
                        id={`option-${index}`}
                        value={option}
                        onChange={(event) => updateOption(index, event.target.value)}
                        maxLength={LIMITS.option}
                        placeholder={`선택지 ${index + 1}`}
                        className={`${inputClass} mt-0`}
                      />
                      {errors[`option-${index}`] ? (
                        <p className="text-sm text-danger" role="alert">
                          {errors[`option-${index}`]}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-2">
                        {image ? (
                          <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-line">
                            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                            <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              aria-label={`선택지 ${index + 1} 사진 삭제`}
                              onClick={() => clearOptionImage(index)}
                              className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/80 text-card"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <label
                            htmlFor={inputId}
                            className="pressable inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-line px-3 text-sm font-semibold text-muted hover:border-accent hover:text-accent"
                          >
                            <ImagePlus className="h-4 w-4" aria-hidden="true" />
                            사진 넣기
                          </label>
                        )}
                        <input
                          id={inputId}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(event) => {
                            setOptionImage(index, event.target.files);
                            event.target.value = "";
                          }}
                        />
                        <p className="text-xs text-muted">부가 설명용 · 2MB 이하</p>
                      </div>
                      {errors[`optionImage-${index}`] ? (
                        <p className="text-sm text-danger" role="alert">
                          {errors[`optionImage-${index}`]}
                        </p>
                      ) : null}
                    </div>
                    {options.length > LIMITS.minOptions ? (
                      <button
                        type="button"
                        aria-label={`선택지 ${index + 1} 삭제`}
                        onClick={() => removeOption(index)}
                        className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-card hover:text-foreground"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="mt-1 inline-flex h-10 w-10 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {options.length < LIMITS.maxOptions ? (
            <button
              type="button"
              onClick={addOption}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-line px-4 text-sm font-semibold text-foreground hover:border-foreground/30"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              선택지 추가
            </button>
          ) : null}
        </section>

        <div className="absolute left-[-9999px] h-0 overflow-hidden" aria-hidden="true">
          <label>
            회사
            <input value={company} onChange={(event) => setCompany(event.target.value)} tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {message ? (
          <p className="rounded-2xl border border-danger/15 bg-[#fff5f7] px-4 py-3 text-sm leading-6 text-danger" role="status">
            {message}
          </p>
        ) : null}
      </div>

      <div className="border-t border-line bg-background/70 px-5 py-4 sm:px-8">
        <button
          type="submit"
          disabled={blocked}
          className="btn-primary inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold"
        >
          {pending ? "올리는 중…" : dupChecking ? "중복 확인 중…" : "질문 올리기"}
        </button>
        <p className="mt-2 text-center text-xs leading-5 text-muted">올리면 바로 공개되고, 하루 최대 3개까지 작성할 수 있어요.</p>
      </div>
    </form>
  );
}

const inputClass =
  "mt-2 w-full rounded-2xl border border-line bg-background px-3.5 py-3 text-base outline-none transition placeholder:text-muted/70 focus:border-accent";

function isCategoryValue(value: string): value is Category {
  return CATEGORIES.some((item) => item === value);
}

function SectionLabel({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{hint}</p>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold">
      <span className="sr-only">
        {label}
        {required ? " (필수)" : ""}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block font-normal text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
