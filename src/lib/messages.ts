const MESSAGES: Record<string, string> = {
  already_voted: "이미 이 질문에 투표했습니다.",
  already_commented: "이 질문에는 의견을 한 번만 남길 수 있습니다.",
  already_replied: "이 의견에는 답글을 한 번만 남길 수 있습니다.",
  own_like: "내가 쓴 글에는 추천할 수 없습니다.",
  already_reported: "이미 신고한 내용입니다.",
  already_reviewed: "이미 검토가 끝난 항목입니다.",
  auth_required: "참여를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  anonymous_disabled:
    "익명 참여 설정이 아직 켜져 있지 않습니다. Supabase에서 Anonymous sign-ins를 활성화해 주세요.",
  forbidden: "이 작업을 할 권한이 없습니다.",
  invalid: "입력 내용을 다시 확인해 주세요.",
  not_found: "대상을 찾을 수 없습니다.",
  rate_limited: "질문 작성은 하루 최대 3개입니다.",
  unavailable: "지금은 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  unpublished: "아직 공개되지 않은 질문입니다.",
  vote_required: "투표한 뒤에 이유를 남길 수 있습니다.",
  profile_required: "닉네임을 먼저 설정해 주세요.",
  nickname_taken: "이미 사용 중인 닉네임입니다. 다른 이름을 골라 주세요.",
  duplicate_title: "같은 제목의 질문이 이미 있어요. 표현을 조금 바꿔 주세요.",
  duplicate_description: "같은 내용의 질문이 이미 있어요. 설명을 다르게 적어 주세요.",
  duplicate: "이미 올라간 질문과 겹쳐요. 제목이나 내용을 바꿔 주세요.",
};

export function messageForCode(code: string): string {
  return MESSAGES[code] ?? "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
