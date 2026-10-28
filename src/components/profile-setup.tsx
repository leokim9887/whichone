"use client";

import { Camera, LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { ProfileAvatar } from "@/components/profile-avatar";
import { LIMITS } from "@/lib/limits";
import { messageForCode } from "@/lib/messages";
import { suggestNickname, writeDemoProfile } from "@/lib/profile-storage";
import type { DataMode, UserProfile } from "@/lib/types";
import { validateAvatarFile, validateNickname } from "@/lib/validation";
import { saveProfileAction } from "@/server/actions";

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function ProfileSetupModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: DataMode;
  initial: UserProfile | null;
  onClose: () => void;
  onSaved: (profile: UserProfile) => void;
}) {
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(() => initial?.nickname || suggestNickname());
  const [preview, setPreview] = useState<string | null>(initial?.avatarUrl ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  async function save() {
    setMessage(null);
    const nick = validateNickname(nickname);
    if (!nick.ok) {
      setErrors(nick.errors);
      return;
    }
    const avatar = validateAvatarFile(file, !initial?.avatarUrl && !preview);
    if (!avatar.ok) {
      setErrors(avatar.errors);
      return;
    }
    if (!file && !initial?.avatarUrl && !preview) {
      setErrors({ avatar: "프로필 사진을 선택해 주세요." });
      return;
    }
    setErrors({});
    setPending(true);

    if (mode === "demo") {
      let avatarUrl = initial?.avatarUrl ?? "";
      if (file) {
        try {
          avatarUrl = await readFileAsDataUrl(file);
        } catch {
          setPending(false);
          setErrors({ avatar: "사진을 읽지 못했습니다. 다시 선택해 주세요." });
          return;
        }
      } else if (preview && !preview.startsWith("blob:")) {
        avatarUrl = preview;
      }
      if (!avatarUrl) {
        setPending(false);
        setErrors({ avatar: "프로필 사진을 선택해 주세요." });
        return;
      }
      const profile = { nickname: nick.value.nickname, avatarUrl };
      writeDemoProfile(profile);
      setPending(false);
      onSaved(profile);
      return;
    }

    const formData = new FormData();
    formData.set("nickname", nick.value.nickname);
    if (file) {
      formData.set("avatar", file);
    } else if (initial?.avatarUrl) {
      formData.set("keepAvatarUrl", initial.avatarUrl);
    }

    const result = await saveProfileAction(formData);
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors ?? {});
      setMessage(result.message || messageForCode(result.code));
      return;
    }
    onSaved(result.profile);
  }

  function onPick(next: FileList | null) {
    const picked = next?.[0] ?? null;
    if (!picked) {
      return;
    }
    const checked = validateAvatarFile(picked, true);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.avatar;
      return nextErrors;
    });
    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-3xl border border-line bg-card p-5 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-xl font-bold">
              {initial ? "프로필 수정" : "프로필 설정"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              투표·댓글·답글·질문 제안 전에 고유 닉네임과 프로필 사진을 정해 주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted"
            aria-label="닫기"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative rounded-full focus-visible:outline-offset-4"
              aria-label="프로필 사진 선택"
            >
              {preview ? (
                <ProfileAvatar profile={{ nickname: nickname || "나", avatarUrl: preview }} size="lg" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-full bg-background text-muted">
                  <Camera className="h-6 w-6" aria-hidden="true" />
                </span>
              )}
              <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-accent text-white">
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => onPick(event.target.files)}
            />
            {errors.avatar ? (
              <p className="text-sm text-danger" role="alert">
                {errors.avatar}
              </p>
            ) : (
              <p className="text-xs text-muted">JPG·PNG·WEBP, 최대 2MB</p>
            )}
          </div>

          <label className="block text-sm font-semibold" htmlFor="profile-nickname">
            닉네임
            <input
              id="profile-nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={LIMITS.nicknameMax}
              autoComplete="nickname"
              placeholder="어느분1234"
              className="mt-2 w-full rounded-2xl border border-line bg-background px-3 py-3 font-normal"
            />
          </label>
          <p className="text-right text-xs text-muted">
            {nickname.trim().length}/{LIMITS.nicknameMax} · 한글·영문·숫자·_
          </p>
          {errors.nickname ? (
            <p className="text-sm text-danger" role="alert">
              {errors.nickname}
            </p>
          ) : null}

          {message ? (
            <p className="rounded-2xl border border-danger/20 px-3 py-2 text-sm text-danger" role="alert">
              {message}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted"
            >
              나중에
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {pending ? "저장 중" : "저장하고 시작"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
