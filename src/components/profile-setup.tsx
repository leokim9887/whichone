"use client";

import { Camera, LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { ProfileAvatar } from "@/components/profile-avatar";
import { LIMITS } from "@/lib/limits";
import { messageForCode } from "@/lib/messages";
import {
  clearDemoProfile,
  isDemoNicknameTaken,
  suggestNickname,
  writeDemoProfile,
} from "@/lib/profile-storage";
import type { DataMode, UserProfile } from "@/lib/types";
import { clampNicknameInput, validateAvatarFile, validateNickname } from "@/lib/validation";
import {
  checkNicknameAvailableAction,
  deleteProfileAction,
  saveProfileAction,
} from "@/server/actions";

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
  onDeleted,
}: {
  mode: DataMode;
  initial: UserProfile | null;
  onClose: () => void;
  onSaved: (profile: UserProfile) => void;
  onDeleted: () => void;
}) {
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const checkSeq = useRef(0);
  const [nickname, setNickname] = useState(() =>
    clampNicknameInput(initial?.nickname || suggestNickname()),
  );
  const [preview, setPreview] = useState<string | null>(initial?.avatarUrl ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [clearedAvatar, setClearedAvatar] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingNick, setCheckingNick] = useState(false);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  async function verifyNickname(value: string): Promise<boolean> {
    const nick = validateNickname(value);
    if (!nick.ok) {
      setErrors((current) => ({ ...current, ...nick.errors }));
      return false;
    }

    if (mode === "demo") {
      if (isDemoNicknameTaken(nick.value.nickname, initial?.nickname)) {
        const taken = messageForCode("nickname_taken");
        setErrors((current) => ({ ...current, nickname: taken }));
        return false;
      }
      setErrors((current) => {
        const next = { ...current };
        delete next.nickname;
        return next;
      });
      return true;
    }

    const seq = ++checkSeq.current;
    setCheckingNick(true);
    const result = await checkNicknameAvailableAction(nick.value.nickname);
    if (seq !== checkSeq.current) {
      return false;
    }
    setCheckingNick(false);
    if (!result.ok) {
      setErrors((current) => ({ ...current, ...(result.errors ?? { nickname: result.message }) }));
      return false;
    }
    if (!result.available) {
      const taken = messageForCode("nickname_taken");
      setErrors((current) => ({ ...current, nickname: taken }));
      return false;
    }
    setErrors((current) => {
      const next = { ...current };
      delete next.nickname;
      return next;
    });
    return true;
  }

  async function save() {
    setMessage(null);
    const nick = validateNickname(nickname);
    if (!nick.ok) {
      setErrors(nick.errors);
      return;
    }
    const avatar = validateAvatarFile(file, false);
    if (!avatar.ok) {
      setErrors(avatar.errors);
      return;
    }
    const available = await verifyNickname(nick.value.nickname);
    if (!available) {
      return;
    }
    setErrors({});
    setPending(true);

    if (mode === "demo") {
      let avatarUrl: string | null = clearedAvatar ? null : (initial?.avatarUrl ?? null);
      if (file) {
        try {
          avatarUrl = await readFileAsDataUrl(file);
        } catch {
          setPending(false);
          setErrors({ avatar: "사진을 읽지 못했습니다. 다시 선택해 주세요." });
          return;
        }
      } else if (preview && !preview.startsWith("blob:") && !clearedAvatar) {
        avatarUrl = preview;
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
    } else if (clearedAvatar) {
      formData.set("clearAvatar", "1");
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
    setClearedAvatar(false);
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  function clearPhoto() {
    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }
    setFile(null);
    setPreview(null);
    setClearedAvatar(true);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  async function removeProfile() {
    if (!initial) {
      return;
    }
    const confirmed = window.confirm(
      "프로필을 삭제할까요? 닉네임과 사진이 지워지며, 다시 설정하기 전에는 투표·댓글·질문 제안을 할 수 없습니다.",
    );
    if (!confirmed) {
      return;
    }
    setMessage(null);
    setDeleting(true);

    if (mode === "demo") {
      clearDemoProfile();
      setDeleting(false);
      onDeleted();
      return;
    }

    const result = await deleteProfileAction();
    setDeleting(false);
    if (!result.ok) {
      setMessage(result.message || messageForCode(result.code));
      return;
    }
    onDeleted();
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
              투표·댓글·답글·질문 제안 전에 고유 닉네임을 정해 주세요. 프로필 사진은 선택 사항입니다.
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
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-xs font-semibold text-accent"
              >
                사진 선택
              </button>
              {preview ? (
                <button type="button" onClick={clearPhoto} className="text-xs font-semibold text-muted">
                  사진 없애기
                </button>
              ) : null}
            </div>
            {errors.avatar ? (
              <p className="text-sm text-danger" role="alert">
                {errors.avatar}
              </p>
            ) : (
              <p className="text-xs text-muted">선택 사항 · JPG·PNG·WEBP, 최대 2MB</p>
            )}
          </div>

          <label className="block text-sm font-semibold" htmlFor="profile-nickname">
            닉네임
            <input
              id="profile-nickname"
              value={nickname}
              onChange={(event) => {
                setNickname(clampNicknameInput(event.target.value));
                setErrors((current) => {
                  if (!current.nickname) {
                    return current;
                  }
                  const next = { ...current };
                  delete next.nickname;
                  return next;
                });
              }}
              onBlur={() => {
                void verifyNickname(nickname);
              }}
              maxLength={LIMITS.nicknameMax}
              autoComplete="nickname"
              placeholder="어느분1234"
              aria-invalid={Boolean(errors.nickname)}
              className="mt-2 w-full rounded-2xl border border-line bg-background px-3 py-3 font-normal"
            />
          </label>
          <p className="text-right text-xs text-muted">
            {nickname.length}/{LIMITS.nicknameMax} · 한글·영문·숫자·_
            {checkingNick ? " · 확인 중" : ""}
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

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {initial ? (
              <button
                type="button"
                onClick={() => void removeProfile()}
                disabled={pending || deleting}
                className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-danger disabled:opacity-60"
              >
                {deleting ? "삭제 중" : "프로필 삭제"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={deleting}
                className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted disabled:opacity-60"
              >
                나중에
              </button>
              <button
                type="submit"
                disabled={pending || deleting || checkingNick || Boolean(errors.nickname)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {pending ? "저장 중" : initial ? "저장" : "저장하고 시작"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
