/**
 * Cloudflare Workers + Hono 예시
 * 문의를 DB에 저장한 직후, Apps Script 웹앱으로 알림 요청을 보냅니다.
 *
 * - 웹앱 URL은 코드에 직접 쓰지 말고 시크릿(NOTIFY_WEBHOOK_URL)으로 등록하세요. (README 참고)
 * - waitUntil을 쓰면 메일 전송을 기다리지 않고 바로 응답하고,
 *   전송이 실패해도 문의 저장과 응답에는 영향이 없습니다.
 */
import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  NOTIFY_WEBHOOK_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.post('/api/inquiries', async (c) => {
  const { name, company_name, phone, address, install_date, indoor_unit_count, message } = await c.req.json()

  if (!name || !phone) {
    return c.json({ success: false, error: '이름과 연락처는 필수입니다.' }, 400)
  }

  // ① DB 저장 (기존 로직)
  const result = await c.env.DB.prepare(
    'INSERT INTO inquiries (name, company_name, phone, address, install_date, indoor_unit_count, message) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(
      name,
      company_name ?? null,
      phone,
      address ?? null,
      install_date ?? null,
      indoor_unit_count ?? null,
      message ?? null
    )
    .run()

  // ② 메일 알림: 응답을 늦추지 않도록 백그라운드로 전송
  if (c.env.NOTIFY_WEBHOOK_URL) {
    c.executionCtx.waitUntil(
      fetch(c.env.NOTIFY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company_name, phone, address, install_date, indoor_unit_count, message }),
      }).catch((err) => console.error('inquiry notify failed', err))
    )
  }

  return c.json({ success: true, id: result.meta.last_row_id })
})

export default app
