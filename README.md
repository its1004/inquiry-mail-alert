# 홈페이지 문의 → 회사 메일 알림 (무료, API 키 없이)

홈페이지 문의 폼에 글이 들어오면 지금처럼 DB에 저장하면서, 같은 내용을 회사 메일로도 보내는 연동입니다.
Cloudflare Workers / Pages에서 돌아가는 Hono 앱(젠스파크 같은 AI 빌더로 만든 사이트 포함)을 기준으로 했고, 메일 서비스 가입이나 API 키 없이 구글 계정 하나로 동작합니다.

## 왜 이렇게 만들었나

- Cloudflare Workers는 서버리스 환경이라 일반 서버처럼 SMTP로 메일을 보내도록 설정하기가 까다롭습니다. 보통은 Resend 같은 메일 발송 API에 가입하고 API 키를 관리해야 합니다.
- 여기서는 **Google Apps Script 웹앱을 중간 발송기**로 둡니다. 서버는 HTTP 요청 한 번만 보내고, 메일은 Apps Script가 Gmail로 보냅니다.

## 동작 흐름

```
방문자 → 문의 폼 제출
          ↓
홈페이지 서버 (POST /api/inquiries)
  ├─ ① DB 저장 (기존 그대로)
  └─ ② Apps Script 웹앱으로 JSON POST (백그라운드, waitUntil)
          ↓
Apps Script (doPost) → MailApp → 회사 메일함
```

## 파일 구성

| 파일 | 내용 |
|---|---|
| `apps-script/Code.gs` | 문의 JSON을 받아 표 형식의 HTML 메일로 보내는 Apps Script |
| `server/inquiry-notify.ts` | Hono(Cloudflare Workers) 서버에서 저장 직후 알림을 보내는 예시 |

## 설정 순서

### 1. Apps Script 웹앱 만들기

1. [script.google.com](https://script.google.com) → 새 프로젝트
2. `apps-script/Code.gs` 내용을 붙여넣고, 맨 위 `TO`, `SITE_NAME`, `ADMIN_URL`을 내 값으로 바꾼 뒤 저장
   - 폼 항목이 다르면 `FIELDS` 목록을 폼의 name 값에 맞게 수정
3. 배포 → 새 배포 → 유형 선택: **웹 앱**
   - 다음 사용자 인증 정보로 실행: **나**
   - 액세스 권한이 있는 사용자: **모든 사용자** (서버가 로그인 없이 호출하기 때문)
4. **액세스 승인** → 계정 선택
   - "Google hasn't verified this app" 화면이 나오면 **Advanced** → **Go to 프로젝트명 (unsafe)**
   - 직접 만든 스크립트는 구글 심사를 거치지 않아서 항상 이 화면이 뜹니다. 화면에 표시된 개발자가 본인 계정인지 확인하고 진행하세요.
   - 권한 화면에서 **Select all** → **Continue** (요청 권한은 "내 이름으로 메일 보내기" 하나)
5. 배포가 끝나면 나오는 웹 앱 URL(`https://script.google.com/macros/s/…/exec`)을 복사

### 2. 서버에 연결하기

1. 웹앱 URL을 시크릿으로 등록 (코드에 직접 쓰지 않기)

   ```bash
   # Cloudflare Workers
   npx wrangler secret put NOTIFY_WEBHOOK_URL

   # Cloudflare Pages
   npx wrangler pages secret put NOTIFY_WEBHOOK_URL --project-name <프로젝트명>
   ```

2. 문의를 DB에 저장한 직후, `server/inquiry-notify.ts`의 ② 부분처럼 `c.executionCtx.waitUntil(fetch(...))`를 추가하고 배포
   - AI 빌더로 만든 사이트라면 이 README와 `server/inquiry-notify.ts`를 보여주고 "문의 저장 직후 이 방식으로 웹앱에 POST 하도록 추가해줘"라고 요청하면 됩니다.

### 3. 테스트

- 연결 확인: 이름·연락처 없이 보내면 메일 없이 `{"ok":false, ...}`만 돌아옵니다.

  ```bash
  curl -L "<웹앱 URL>" -H "Content-Type: application/json" -d '{"ping":true}'
  ```

- 실제 확인: 폼으로 테스트 문의 1건을 넣고 메일이 오는지 확인합니다. Apps Script 왼쪽 메뉴의 **실행**에서 doPost 실행 기록을 볼 수 있습니다.

## 알아둘 점

- **발송 한도**: Apps Script 메일은 일반 Gmail 계정 기준 하루 수신자 100명, Google Workspace 계정 기준 1,500명입니다. ([Apps Script 할당량](https://developers.google.com/apps-script/guides/services/quotas))
- **웹앱 URL은 비밀번호처럼 관리**: 공개되면 누구나 요청을 보내 발송 한도를 소진시킬 수 있습니다. 브라우저(프론트엔드) 코드에 넣지 말고 서버에서만 호출하세요.
- **실패해도 문의는 저장됨**: 메일 전송은 백그라운드라서 실패해도 문의 저장과 방문자 화면에는 영향이 없습니다.
- **코드 수정 후 재배포**: Apps Script를 고친 뒤에는 배포 → 배포 관리 → 수정(연필) → 버전: 새 버전 → 배포. 이렇게 하면 웹앱 URL이 바뀌지 않습니다.
- **발신자**: 메일은 Apps Script를 만든 구글 계정 이름으로 발송됩니다.

## 적용 사례

실제 운영 중인 지역 시스템에어컨 시공업체 홈페이지(젠스파크로 제작, Genspark Hosting)에 적용해 사용하고 있습니다.
