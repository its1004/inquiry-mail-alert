/**
 * 홈페이지 문의 → 메일 알림 (Google Apps Script 웹앱)
 *
 * 홈페이지 서버가 문의를 저장한 뒤 이 웹앱 URL로 JSON을 POST 하면
 * 아래 TO 주소로 알림 메일을 보냅니다. 설정 방법은 README.md 참고.
 */
const TO = 'YOUR_EMAIL@example.com';          // 알림 받을 주소
const SITE_NAME = '우리 회사 홈페이지';          // 메일 발신자 이름
const ADMIN_URL = 'https://example.com/admin';  // 메일 하단 관리자 페이지 링크 (없으면 '')

// 메일에 표시할 항목: [표시 이름, 폼에서 보내는 JSON 키]
const FIELDS = [
  ['이름', 'name'],
  ['기업(단체)명', 'company_name'],
  ['연락처', 'phone'],
  ['주소', 'address'],
  ['시공예정일', 'install_date'],
  ['실내기 대수', 'indoor_unit_count'],
  ['문의 내용', 'message'],
];

function doPost(e) {
  let d = {};
  try {
    d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    d = {};
  }

  // 필수값(이름, 연락처)이 없으면 메일을 보내지 않음 (연결 테스트용으로도 사용)
  if (!d.name || !d.phone) {
    return json({ ok: false, reason: 'missing name or phone' });
  }

  const val = (v) => (v === undefined || v === null || String(v).trim() === '') ? '-' : String(v).slice(0, 3000);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  const rows = FIELDS.map(([label, key]) => [label, val(d[key])]);
  const receivedAt = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');

  const text = rows.map(([label, v]) => label + ': ' + v).join('\n')
    + '\n접수 시각: ' + receivedAt
    + (ADMIN_URL ? '\n\n관리자 페이지: ' + ADMIN_URL : '');

  const html = '<h3 style="margin:0 0 12px">홈페이지 문의가 접수됐습니다</h3>'
    + '<table cellpadding="8" style="border-collapse:collapse;font-size:14px">'
    + rows.map(([label, v]) => '<tr><th align="left" style="border:1px solid #ddd;background:#f6f6f6;white-space:nowrap">'
      + label + '</th><td style="border:1px solid #ddd">' + esc(v) + '</td></tr>').join('')
    + '</table>'
    + '<p style="color:#666;font-size:13px">접수 시각: ' + receivedAt + ' (KST)'
    + (ADMIN_URL ? '<br>관리자 페이지: <a href="' + ADMIN_URL + '">' + ADMIN_URL + '</a>' : '')
    + '</p>';

  MailApp.sendEmail({
    to: TO,
    subject: '[홈페이지 문의] ' + val(d.name) + ' / ' + val(d.phone),
    body: text,
    htmlBody: html,
    name: SITE_NAME,
  });

  return json({ ok: true });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
