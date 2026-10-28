# WhicHOne

사람들의 선택으로 완성되는 참여형 투표 웹 서비스입니다. 로그인 없이 질문에 투표하고, 투표 뒤에 선택 비율과 이유를 확인합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.

`NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 없으면 **로컬 데모 모드**로 실행됩니다.

- 화면에 데모 안내가 표시됩니다.
- 예시 질문 18개가 보입니다.
- 투표, 의견, 제안, 신고는 이 브라우저의 localStorage에만 저장됩니다.
- 이 기록은 다른 사람과 공유되지 않으며, 실제 참여 수가 아닙니다.
- 데모 모드에는 가상의 득표율을 넣지 않습니다. 직접 투표한 뒤에만 이 브라우저 기록을 보여 줍니다.

## 환경 변수

`.env.example`을 복사해 `.env.local`을 만듭니다.

| 이름 | 어디에 쓰나 | 공개 여부 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 브라우저에 공개되는 값 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 | 브라우저에 공개되는 값. RLS로 권한이 제한됩니다. |
| `NEXT_PUBLIC_SITE_URL` | 공유용 사이트 주소. 로컬은 `http://localhost:3000` | 공개 값 |

서비스 롤 키는 코드와 환경 변수 예시에 넣지 않습니다. 이 MVP는 그 키 없이 anon 키와 데이터베이스 함수로 동작합니다.

## Supabase 연결

1. Supabase에서 새 프로젝트를 만듭니다.
2. Authentication → Sign In / Providers에서 **Anonymous sign-ins**를 켭니다. 끄면 투표할 때 설정 안내가 나옵니다.
3. SQL Editor에서 `supabase/migrations/` 안의 `.sql` 파일을 이름 순서대로 실행합니다. 처음이면 `20261023120000_init.sql`부터, 이미 연결한 프로젝트면 아직 안 돌린 파일만 이어서 실행하면 됩니다. 프로필·아바타 기능은 `20261028200000_profiles.sql`이 필요합니다.
4. 이어서 `supabase/seed.sql` 전체를 한 번에 실행합니다. 질문과 선택지만 들어가고, 가짜 투표는 들어가지 않습니다. 파일 안의 `begin`부터 `commit`까지 한 트랜잭션으로 실행해야 합니다.
5. `.env.local`에 Project URL과 anon public 키를 넣습니다. Settings → API에서 확인할 수 있습니다.
6. 개발 서버를 다시 시작합니다. 데모 안내가 사라지고 데이터베이스의 공개 질문이 보입니다.

투표·댓글·답글·질문 제안 전에 고유 닉네임과 프로필 사진(본인 선택)을 설정해야 합니다. 댓글·답글과 승인된 질문에는 닉네임이 표시됩니다.

### 관리자

1. Supabase Authentication에서 관리자용 이메일 사용자를 만듭니다. 일반 참여자의 익명 계정과 별도입니다.
2. SQL Editor에서 그 사용자의 UUID만 등록합니다.

```sql
insert into public.admin_users (user_id)
values ('여기에-관리자-uuid');
```

3. `/admin`에서 그 이메일과 비밀번호로 로그인합니다. 주소만 알거나 익명 참여자 상태에서는 승인, 숨김, 삭제를 할 수 없습니다.

관리자 화면에서 질문 제안을 승인하거나 거절하고, 질문 공개 상태를 바꾸고, 신고된 의견이나 질문을 숨기거나 의견을 삭제할 수 있습니다. 승인된 제안만 공개 질문이 됩니다.

## 스크립트

```bash
npm run dev
npm run test
npm run lint
npm run build
```

시드 SQL을 질문 원본과 다시 맞출 때:

```bash
node --experimental-strip-types scripts/build-seed-sql.ts
```

## 배포

Vercel에 이 프로젝트를 연결하고, 위의 공개 환경 변수 3개를 Production 환경에 넣습니다. Supabase 대시보드의 Authentication → URL Configuration에 배포 주소를 추가합니다. 서비스 롤 키는 Vercel에도 넣지 않아도 됩니다.
