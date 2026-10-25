"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { categoryLabel } from "@/lib/categories";
import { addDemoSuggestion } from "@/lib/demo-state";
import { readDemoState, writeDemoState } from "@/lib/demo-storage";
import { LIMITS } from "@/lib/limits";
import { messageForCode } from "@/lib/messages";
import { CATEGORIES, type DataMode } from "@/lib/types";
import { validateSuggestion } from "@/lib/validation";
import { submitSuggestionAction, type FieldErrors } from "@/server/actions";

export function SuggestForm({ mode }: { mode: DataMode }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [company, setCompany] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, optionIndex) => (optionIndex === index ? value : option)));
  }

  async function submit() {
    setMessage(null);
    const validated = validateSuggestion({ title, description, category, options });
    if (!validated.ok) {
      setErrors(validated.errors);
      return;
    }
    setErrors({});
    setPending(true);

    if (mode === "demo") {
      const result = addDemoSuggestion(readDemoState(), validated.value);
      setPending(false);
      if (!result.ok) {
        setMessage(messageForCode(result.code));
        return;
      }
      writeDemoState(result.state);
      setMessage("제안을 이 브라우저에만 저장했습니다. 검토 대기 상태이며 공개되지 않습니다.");
      setTitle("");
      setDescription("");
      setCategory("");
      setOptions(["", ""]);
      return;
    }

    const result = await submitSuggestionAction({
      title,
      description,
      category,
      options,
      company,
    });
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors ?? {});
      setMessage(result.message);
      return;
    }
    setMessage(result.message);
    setTitle("");
    setDescription("");
    setCategory("");
    setOptions(["", ""]);
    router.refresh();
  }

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
        <select value={category} onChange={(event) => setCategory(event.target.value)} required className={inputClass}>
          <option value="">주제를 선택하세요</option>
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {categoryLabel(item)}
            </option>
          ))}
        </select>
      </Field>

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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={options.length >= LIMITS.maxOptions}
            onClick={() => setOptions((current) => [...current, ""])}
            className="inline-flex min-h-11 items-center rounded-2xl border border-line px-4 text-sm font-semibold disabled:opacity-50"
          >
            선택지 추가
          </button>
          <button
            type="button"
            disabled={options.length <= LIMITS.minOptions}
            onClick={() => setOptions((current) => current.slice(0, -1))}
            className="inline-flex min-h-11 items-center rounded-2xl border border-line px-4 text-sm font-semibold disabled:opacity-50"
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
        className="inline-flex min-h-12 items-center rounded-2xl bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "보내는 중" : "검토 요청"}
      </button>
    </form>
  );
}

const inputClass = "mt-2 w-full rounded-2xl border border-line bg-background px-3 py-3 text-base";

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
