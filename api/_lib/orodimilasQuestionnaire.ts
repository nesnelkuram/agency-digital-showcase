import { z } from 'zod';
import QUESTIONS from './orodimilasQuestions.json';

// Oro di Milas görüşme soruları: doğrulama, kayıt ve intiba'ya bildirim e-postası.
// Cevaplar önce Firestore'a yazılır, sonra e-posta gönderilir; e-posta aksarsa cevap kaybolmaz.

export const QUESTION_IDS = QUESTIONS.groups.flatMap(group => group.questions.map(q => q.id));
export const ORODIMILAS_COLLECTION = 'orodimilas_questionnaires';
export const NOTIFY_TO = process.env.ORODIMILAS_NOTIFY_TO || 'nesnelkuram@gmail.com';
const FROM = 'intiba <info@intiba.co.uk>';

const clean = (max: number) => z.string().trim().max(max)
  .refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value));

export const questionnaireSchema = z.object({
  requestId: z.string().uuid(),
  name: clean(120).pipe(z.string().min(2)),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: clean(40).default(''),
  company: clean(120).default(''),
  answers: z.record(z.enum(QUESTION_IDS as [string, ...string[]]), clean(4000)).default({}),
  website: z.string().max(200).default(''),
}).strict();
export type QuestionnaireInput = z.infer<typeof questionnaireSchema>;

export class QuestionnaireError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const escape = (value: string) => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

export function buildEmail(input: QuestionnaireInput, reference: string) {
  const answered = QUESTION_IDS.filter(id => input.answers[id]?.trim()).length;
  const subject = `Oro di Milas · Görüşme soruları yanıtlandı · ${input.name}`;
  const contact = [
    ['Ad soyad', input.name], ['E-posta', input.email], ['Telefon', input.phone], ['Firma', input.company],
  ].filter(([, v]) => v);
  const groupsHtml = QUESTIONS.groups.map(group => {
    const rows = group.questions.map(q => {
      const answer = input.answers[q.id]?.trim();
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #e0d8c4;vertical-align:top">
        <div style="font:12px/1.5 Arial,sans-serif;color:#85652a">${escape(q.text)}</div>
        <div style="font:15px/1.6 Georgia,serif;color:${answer ? '#1a1b14' : '#9a9484'};margin-top:4px;white-space:pre-wrap">${answer ? escape(answer) : 'Yanıtlanmadı'}</div>
      </td></tr>`;
    }).join('');
    return `<h3 style="font:600 13px/1.4 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#2e3a1f;margin:28px 0 4px">${escape(group.title)}</h3><table width="100%" cellspacing="0" cellpadding="0">${rows}</table>`;
  }).join('');
  const html = `<div style="max-width:640px;margin:0 auto;padding:24px;background:#faf7ef">
    <p style="font:12px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#85652a;margin:0">Oro di Milas · Görüşme soruları</p>
    <h2 style="font:400 26px Georgia,serif;color:#2e3a1f;margin:8px 0 4px">${escape(input.name)} yanıtları gönderdi</h2>
    <p style="font:14px Arial,sans-serif;color:#6b6755;margin:0">${answered} / ${QUESTION_IDS.length} soru yanıtlandı · Referans ${reference}</p>
    <table style="margin-top:16px" cellspacing="0" cellpadding="0">${contact.map(([k, v]) => `<tr><td style="font:13px Arial,sans-serif;color:#6b6755;padding:2px 16px 2px 0">${k}</td><td style="font:14px Arial,sans-serif;color:#1a1b14">${escape(v)}</td></tr>`).join('')}</table>
    ${groupsHtml}
    <p style="font:12px Arial,sans-serif;color:#9a9484;margin-top:28px">Bu e-postayı yanıtladığınızda doğrudan ${escape(input.email)} adresine gider.</p>
  </div>`;
  const text = [
    `Oro di Milas · Görüşme soruları — ${input.name}`,
    `${answered} / ${QUESTION_IDS.length} soru yanıtlandı · Referans ${reference}`,
    ...contact.map(([k, v]) => `${k}: ${v}`),
    ...QUESTIONS.groups.flatMap(group => ['', `## ${group.title}`, ...group.questions.flatMap(q => [`- ${q.text}`, `  ${input.answers[q.id]?.trim() || 'Yanıtlanmadı'}`])]),
  ].join('\n');
  return { subject, html, text, answered };
}

type Store = { create(id: string, data: Record<string, unknown>): Promise<'created' | 'exists'> };
type Mailer = (message: { to: string; replyTo: string; subject: string; html: string; text: string }) => Promise<void>;

export async function submitQuestionnaire(input: QuestionnaireInput, deps: { store: Store; mail: Mailer; now?: () => Date }) {
  if (input.website) throw new QuestionnaireError(400, 'Gönderim doğrulanamadı.');
  if (!QUESTION_IDS.some(id => input.answers[id]?.trim())) throw new QuestionnaireError(400, 'Lütfen en az bir soruyu yanıtlayın.');
  const reference = `ODM-${input.requestId.replaceAll('-', '').slice(0, 10).toUpperCase()}`;
  const { website: _website, ...data } = input;
  const status = await deps.store.create(input.requestId, {
    ...data, reference, version: QUESTIONS.version, tenantId: 'intiba', source: 'orodimilas-web',
    createdAt: (deps.now?.() ?? new Date()).toISOString(),
  });
  if (status === 'exists') return { reference, duplicate: true, emailed: false };
  const email = buildEmail(input, reference);
  let emailed = true;
  try {
    await deps.mail({ to: NOTIFY_TO, replyTo: input.email, subject: email.subject, html: email.html, text: email.text });
  } catch {
    // Cevap kayıtlı; e-posta hatası müşteriye yansıtılmaz, sunucu günlüğüne düşer.
    emailed = false;
    console.error('[orodimilas] Bildirim e-postası gönderilemedi', reference);
  }
  return { reference, duplicate: false, emailed };
}

export async function resendMail(message: { to: string; replyTo: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY eksik');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [message.to], reply_to: message.replyTo, subject: message.subject, html: message.html, text: message.text }),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}`);
}
