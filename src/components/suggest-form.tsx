"use client";

import { useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";

import { useProfile } from "@/components/profile-provider";
import { categoryLabel } from "@/lib/categories";
import { addDemoSuggestion } from "@/lib/demo-state";
import { readDemoState, writeDemoState } from "@/lib/demo-storage";
import { LIMITS } from "@/lib/limits";
import { messageForCode } from "@/lib/messages";
import { topicsFor, type Topic } from "@/lib/topics";
import { CATEGORIES, type Category, type DataMode } from "@/lib/types";
import { validateSuggestion } from "@/lib/validation";
import { submitSuggestionAction, type FieldErrors } from "@/server/actions";

const SUGGEST_RESET_KEY = "whichone:suggest-reset";

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
  const { ensureProfile, openSetup } = useProfile();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [company, setCompany] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetForm() {
    setTitle("");
    setDescription("");
    setCategory("");
    setTopic("");
    setOptions(["", ""]);
    setCompany("");
    setErrors({});
    setMessage(null);
    setPending(false);
  }

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, optionIndex) => (optionIndex === index ? value : option)));
  }

  function notifyRateLimited() {
    const text = messageForCode("rate_limited");
    window.alert(text);
    setMessage(text);
  }

  function goHomeClean() {
    try {
      sessionStorage.setItem(SUGGEST_RESET_KEY, "1");
    } catch {
      // ignore storage failures
    }
    flushSync(() => {
      resetForm();
    });
    router.replace("/");
    router.refresh();
  }

  async function submit() {
    setMessage(null);
    const validated = validateSuggestion({ title, description, category, topic, options });
    if (!validated.ok) {
      setErrors(validated.errors);
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
      const result = addDemoSuggestion(readDemoState(), validated.value);
      if (!result.ok) {
        setPending(false);
        if (result.code === "rate_limited") {
          notifyRateLimited();
          return;
        }
        setMessage(messageForCode(result.code));
        return;
      }
      writeDemoState(result.state);
      goHomeClean();
      return;
    }

    const result = await submitSuggestionAction({
      title,
      description,
      category,
      topic,
      options,
      company,
    });
    if (!result.ok) {
      setPending(false);
      if (result.code === "profile_required") {
        openSetup();
      }
      if (result.code === "rate_limited") {
        notifyRateLimited();
        return;
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

  return (
    <form
      className="space-y-5 rounded-3xl border border-line bg-card p-5 sm:p-7"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field label="질문 제목" error={errors.title} required>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={LIMITS.title}
          required
          className={inputClass}
        />
      </Field>
      <p className="text-right text-xs text-muted">
        {title.length}/{LIMITS.title}
      </p>

      <Field label="주제" error={errors.category} required>
        <select value={category} onChange={(event) => chooseCategory(event.target.value)} required className={inputClass}>
          <option value="">주제를 선택하세요</option>
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {categoryLabel(item)}
            </option>
          ))}
        </select>
      </Field>

      {topicChoices.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">세부 주제</legend>
          <div className="grid gap-2">
            {topicChoices.map((item) => {
              const active = topic === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseTopic(item)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                    active ? "border-foreground bg-foreground text-card" : "border-line bg-background"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {errors.topic ? <p className="text-sm text-danger">{errors.topic}</p> : null}
        </fieldset>
      ) : null}

      <Field label="설명" error={errors.description}>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={LIMITS.description}
          rows={3}
          className={inputClass}
        />
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">선택지 2~4개</legend>
        {errors.options ? (
          <p className="text-sm text-danger" role="alert">
            {errors.options}
          </p>
        ) : null}
        {options.map((option, index) => (
          <div key={index}>
            <label className="block text-sm font-semibold" htmlFor={`option-${index}`}>
              선택지 {index + 1}
              <input
                id={`option-${index}`}
                value={option}
                onChange={(event) => updateOption(index, event.target.value)}
                maxLength={LIMITS.option}
                className={`${inputClass} font-normal`}
              />
            </label>
            {errors[`option-${index}`] ? (
              <p className="mt-1 text-sm text-danger" role="alert">
                {errors[`option-${index}`]}
              </p>
            ) : null}
          </div>
        ))}
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            disabled={options.length >= LIMITS.maxOptions}
            onClick={() => setOptions((current) => [...current, ""])}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-semibold disabled:opacity-50 sm:justify-start"
          >
            선택지 추가
          </button>
          <button
            type="button"
            disabled={options.length <= LIMITS.minOptions}
            onClick={() => setOptions((current) => current.slice(0, -1))}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-semibold disabled:opacity-50 sm:justify-start"
          >
            마지막 선택지 삭제
          </button>
        </div>
      </fieldset>

      <div className="absolute left-[-9999px] h-0 overflow-hidden" aria-hidden="true">
        <label>
          회사
          <input value={company} onChange={(event) => setCompany(event.target.value)} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {message ? (
        <p className="text-sm leading-6 text-foreground" role="status">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {pending ? "올리는 중" : "질문 올리기"}
      </button>
    </form>
  );
}

const inputClass = "mt-2 w-full rounded-2xl border border-line bg-background px-3 py-3 text-base";

function isCategoryValue(value: string): value is Category {
  return CATEGORIES.some((item) => item === value);
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
      {label}
      {required ? <span className="text-danger"> *</span> : null}
      {children}
      {error ? (
        <span className="mt-1 block font-normal text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
