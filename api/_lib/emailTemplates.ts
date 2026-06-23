/**
 * Reusable HTML email template builder for intiba transactional emails.
 * Used by various /api/send-* endpoints.
 */

const BASE_STYLE = `
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
  .wrapper { padding: 32px 16px; }
  .container { max-width: 560px; margin: 0 auto; }
  .header { background: #171717; color: white; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center; }
  .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -1px; }
  .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.6; }
  .content { background: #ffffff; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
  .badge-amber { background: #fef3c7; color: #92400e; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .cta { display: inline-block; background: #171717; color: white !important; padding: 14px 28px; border-radius: 100px; text-decoration: none; font-weight: 700; font-size: 15px; margin: 24px 0; }
  .cta-outline { display: inline-block; background: white; color: #171717 !important; border: 2px solid #171717; padding: 12px 26px; border-radius: 100px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 16px 0; }
  .link-box { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #737373; word-break: break-all; margin-top: 12px; }
  .divider { border: none; border-top: 1px solid #f0f0f0; margin: 24px 0; }
  .footer { text-align: center; padding-top: 20px; color: #a3a3a3; font-size: 12px; }
  .metadata { background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; }
  .metadata p { margin: 4px 0; }
  .metadata strong { color: #171717; }
`;

function wrapHtml(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>${BASE_STYLE}</style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>intiba.</h1>
        <p>Dijital Ajans Platformu</p>
      </div>
      <div class="content">
        ${bodyContent}
      </div>
      <div class="footer">
        <p>Bu e-posta intiba platformu tarafından otomatik gönderilmiştir.<br>
        Beklemediğiniz bir e-posta ise görmezden gelebilirsiniz.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// =========================================================
// Content Plan: Submitted for Approval (→ Client)
// =========================================================
export function contentPlanSubmittedEmail(params: {
  recipientName: string;
  senderName: string;
  planTitle: string;
  shareUrl: string;
  weekRange?: string;
  brandName?: string;
  postCount?: number;
}): { subject: string; html: string } {
  const dateLabel = params.weekRange ? params.weekRange : 'yaklaşan dönem';
  const subject = `${params.brandName || params.planTitle} — ${dateLabel} sosyal medya planınız onayınıza sunuldu`;
  const html = wrapHtml(subject, `
    <span class="badge badge-amber">Onay Bekleniyor</span>
    <p>Merhaba <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.brandName || params.planTitle}</strong> markası için <strong>${dateLabel}</strong> tarihlerine ait sosyal medya paylaşım planı onayınıza sunulmuştur.</p>
    <div class="metadata">
      <p><strong>Plan Adı:</strong> ${params.planTitle}</p>
      ${params.weekRange ? `<p><strong>Yayın Dönemi:</strong> ${params.weekRange}</p>` : ''}
      ${typeof params.postCount === 'number' ? `<p><strong>Toplam Gönderi:</strong> ${params.postCount} adet</p>` : ''}
      <p><strong>Hazırlayan:</strong> ${params.senderName}</p>
    </div>
    <p>Aşağıdaki butondan plana giriş yapabilir, her gönderiyi tek tek inceleyip <strong>onaylayabilir</strong> veya <strong>revizyon isteyebilirsiniz</strong>.</p>
    <div style="text-align:center;">
      <a href="${params.shareUrl}" class="cta">Planı İncele ve Onayla</a>
    </div>
    <p style="color:#737373;font-size:13px;margin-top:16px;">Geri bildiriminiz doğrudan ekibimize ulaşır. Link size özeldir ve başkalarıyla paylaşılmamalıdır.</p>
    <div class="link-box">
      Link çalışmıyorsa bu adresi tarayıcınıza kopyalayın:<br>${params.shareUrl}
    </div>
  `);
  return { subject, html };
}

// =========================================================
// Content Plan: Approved (→ Team)
// =========================================================
export function contentPlanApprovedEmail(params: {
  recipientName: string;
  approvedByName: string;
  planTitle: string;
  adminUrl: string;
}): { subject: string; html: string } {
  const subject = `"${params.planTitle}" içerik planı onaylandı`;
  const html = wrapHtml(subject, `
    <span class="badge badge-green">Onaylandı ✓</span>
    <p>Merhaba <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.approvedByName}</strong> aşağıdaki içerik planını onayladı:</p>
    <div class="metadata">
      <p><strong>Plan Adı:</strong> ${params.planTitle}</p>
      <p><strong>Onaylayan:</strong> ${params.approvedByName}</p>
    </div>
    <p>Plan artık zamanlamaya alınabilir. Admin panelinden detayları görmek için:</p>
    <div style="text-align:center;">
      <a href="${params.adminUrl}" class="cta-outline">Admin Paneline Git</a>
    </div>
  `);
  return { subject, html };
}

// =========================================================
// Content Plan: Revision Requested (→ Team)
// =========================================================
export function contentPlanRevisionEmail(params: {
  recipientName: string;
  requestedByName: string;
  planTitle: string;
  comment?: string;
  adminUrl: string;
}): { subject: string; html: string } {
  const subject = `"${params.planTitle}" için revizyon istendi`;
  const html = wrapHtml(subject, `
    <span class="badge badge-red">Revizyon İstendi</span>
    <p>Merhaba <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.requestedByName}</strong> aşağıdaki içerik planı için revizyon istedi:</p>
    <div class="metadata">
      <p><strong>Plan Adı:</strong> ${params.planTitle}</p>
      <p><strong>İsteyen:</strong> ${params.requestedByName}</p>
      ${params.comment ? `<p><strong>Not:</strong> ${params.comment}</p>` : ''}
    </div>
    <p>Lütfen planı gözden geçirip gerekli düzeltmeleri yapın:</p>
    <div style="text-align:center;">
      <a href="${params.adminUrl}" class="cta">Planı Düzenle</a>
    </div>
  `);
  return { subject, html };
}

// =========================================================
// Workflow Step: Assigned (→ Assignee)
// =========================================================
export function workflowStepAssignedEmail(params: {
  recipientName: string;
  workflowName: string;
  stepName: string;
  projectName?: string;
  adminUrl: string;
}): { subject: string; html: string } {
  const subject = `Yeni görev: "${params.stepName}" adımı sıra sende`;
  const html = wrapHtml(subject, `
    <span class="badge badge-blue">Yeni Görev</span>
    <p>Merhaba <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.workflowName}</strong> workflow'unda bir sonraki adım sıra sende:</p>
    <div class="metadata">
      <p><strong>Adım:</strong> ${params.stepName}</p>
      ${params.projectName ? `<p><strong>Proje:</strong> ${params.projectName}</p>` : ''}
    </div>
    <p>Görevi görmek ve başlamak için:</p>
    <div style="text-align:center;">
      <a href="${params.adminUrl}" class="cta">Göreve Git</a>
    </div>
  `);
  return { subject, html };
}

// =========================================================
// Approval Needed (generic)
// =========================================================
export function approvalNeededEmail(params: {
  recipientName: string;
  itemTitle: string;
  itemType: string;
  requestedByName: string;
  adminUrl: string;
}): { subject: string; html: string } {
  const subject = `Onay bekleniyor: ${params.itemTitle}`;
  const html = wrapHtml(subject, `
    <span class="badge badge-amber">Onay Gerekiyor</span>
    <p>Merhaba <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.requestedByName}</strong> aşağıdaki öğe için onayınızı bekliyor:</p>
    <div class="metadata">
      <p><strong>Tür:</strong> ${params.itemType}</p>
      <p><strong>Başlık:</strong> ${params.itemTitle}</p>
    </div>
    <div style="text-align:center;">
      <a href="${params.adminUrl}" class="cta">İncele ve Onayla</a>
    </div>
  `);
  return { subject, html };
}

// =========================================================
// Content Plan: Internal Review Needed (→ Account Manager)
// =========================================================
export function internalReviewNeededEmail(params: {
  recipientName: string;
  submittedByName: string;
  planTitle: string;
  adminUrl: string;
}): { subject: string; html: string } {
  const subject = `Dahili inceleme bekliyor: "${params.planTitle}"`;
  const html = wrapHtml(subject, `
    <span class="badge badge-blue">Dahili Inceleme</span>
    <p>Merhaba <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.submittedByName}</strong> asagidaki icerik planini dahili incelemenize sundu:</p>
    <div class="metadata">
      <p><strong>Plan Adi:</strong> ${params.planTitle}</p>
      <p><strong>Gonderen:</strong> ${params.submittedByName}</p>
    </div>
    <p>Plani incelemek ve onaylamak veya revizyon istemek icin:</p>
    <div style="text-align:center;">
      <a href="${params.adminUrl}" class="cta">Plani Incele</a>
    </div>
  `);
  return { subject, html };
}

// =========================================================
// Content Plan: Internal Approved (→ Editor)
// =========================================================
export function internalApprovedEmail(params: {
  recipientName: string;
  approvedByName: string;
  planTitle: string;
  adminUrl: string;
}): { subject: string; html: string } {
  const subject = `"${params.planTitle}" dahili inceleme onaylandi`;
  const html = wrapHtml(subject, `
    <span class="badge badge-green">Dahili Onay ✓</span>
    <p>Merhaba <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.approvedByName}</strong> asagidaki icerik planinin dahili incelemesini onayladi:</p>
    <div class="metadata">
      <p><strong>Plan Adi:</strong> ${params.planTitle}</p>
      <p><strong>Onaylayan:</strong> ${params.approvedByName}</p>
    </div>
    <p>Icerik artik musteri onayina gonderildi.</p>
    <div style="text-align:center;">
      <a href="${params.adminUrl}" class="cta-outline">Detaylari Gor</a>
    </div>
  `);
  return { subject, html };
}

// =========================================================
// Content Plan: Internal Revision Requested (→ Editor)
// =========================================================
export function internalRevisionEmail(params: {
  recipientName: string;
  requestedByName: string;
  planTitle: string;
  comment?: string;
  adminUrl: string;
}): { subject: string; html: string } {
  const subject = `"${params.planTitle}" dahili revizyon istendi`;
  const html = wrapHtml(subject, `
    <span class="badge badge-amber">Dahili Revizyon</span>
    <p>Merhaba <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.requestedByName}</strong> asagidaki icerik plani icin dahili revizyon istedi:</p>
    <div class="metadata">
      <p><strong>Plan Adi:</strong> ${params.planTitle}</p>
      <p><strong>Isteyen:</strong> ${params.requestedByName}</p>
      ${params.comment ? `<p><strong>Not:</strong> ${params.comment}</p>` : ''}
    </div>
    <p>Lutfen icerigi gozden gecirip gerekli duzeltmeleri yapin:</p>
    <div style="text-align:center;">
      <a href="${params.adminUrl}" class="cta">Plani Duzenle</a>
    </div>
  `);
  return { subject, html };
}

// =========================================================
// Content Plan: Partial Approval (→ Team)
// =========================================================
export function partialApprovalEmail(params: {
  recipientName: string;
  approvedByName: string;
  planTitle: string;
  approvedCount: number;
  totalCount: number;
  adminUrl: string;
}): { subject: string; html: string } {
  const subject = `"${params.planTitle}" kismi onay: ${params.approvedCount}/${params.totalCount}`;
  const html = wrapHtml(subject, `
    <span class="badge badge-amber">Kismi Onay</span>
    <p>Merhaba <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.approvedByName}</strong> asagidaki icerik planindan bazi postlari onayladi:</p>
    <div class="metadata">
      <p><strong>Plan Adi:</strong> ${params.planTitle}</p>
      <p><strong>Onaylanan:</strong> ${params.approvedCount} / ${params.totalCount} post</p>
      <p><strong>Onaylayan:</strong> ${params.approvedByName}</p>
    </div>
    <p>Geri kalan postlar hala onay bekliyor.</p>
    <div style="text-align:center;">
      <a href="${params.adminUrl}" class="cta-outline">Detaylari Gor</a>
    </div>
  `);
  return { subject, html };
}

// =========================================================
// New Lead Notification (→ info@intiba.co.uk)
// =========================================================
export function newLeadNotificationEmail(params: {
  submissionId: string;
  submissionTime: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  sector: string;
  requestedServices: string;
  serviceCount: number;
  stages: { label: string; result: string; score: number }[];
}): { subject: string; html: string } {
  const subject = `Yeni Başvuru: ${params.businessName} — #${params.submissionId}`;

  const stageRows = params.stages
    .map(s => `<p><strong>${s.label}:</strong> ${s.result || 'N/A'} (Skor: ${s.score ?? 0})</p>`)
    .join('');

  const html = wrapHtml(subject, `
    <span class="badge badge-green">Yeni Başvuru</span>
    <p>Marka stratejisi formu üzerinden <strong>yeni bir başvuru</strong> geldi:</p>
    <div class="metadata">
      <p><strong>İşletme:</strong> ${params.businessName}</p>
      <p><strong>Kişi:</strong> ${params.name}</p>
      <p><strong>E-posta:</strong> ${params.email}</p>
      <p><strong>Telefon:</strong> ${params.phone}</p>
      <p><strong>Sektör:</strong> ${params.sector}</p>
      <p><strong>Tarih:</strong> ${params.submissionTime}</p>
    </div>
    <hr class="divider">
    <p><strong>Talep Edilen Hizmetler:</strong> ${params.requestedServices} (${params.serviceCount} hizmet)</p>
    <hr class="divider">
    <p><strong>Aşama Sonuçları:</strong></p>
    <div class="metadata">
      ${stageRows}
    </div>
    <div style="text-align:center;">
      <a href="https://intiba.co.uk/admin/leads" class="cta">Başvuruları Görüntüle</a>
    </div>
    <div class="link-box">
      Submission ID: ${params.submissionId}
    </div>
  `);
  return { subject, html };
}

// =========================================================
// Wizard Invitation: Strategy Form Davet (→ Potansiyel Müşteri)
// =========================================================
// =========================================================
// Task Digest (→ User email)
// =========================================================
export function taskDigestEmail(params: {
  recipientName: string;
  totalActive: number;
  overdueCount: number;
  dueTodayCount: number;
  blockedCount: number;
  delegatableCount: number;
  taskSummaryHtml: string;
  adminUrl: string;
}): { subject: string; html: string } {
  const subject = `Günlük Görev Özeti: ${params.totalActive} aktif görev`;
  const html = wrapHtml(subject, `
    <span class="badge badge-blue">Günlük Özet</span>
    <p>Günaydın <strong>${params.recipientName}</strong>,</p>
    <p>Bugünkü görev özetiniz:</p>
    <div class="metadata">
      <p><strong>Toplam Aktif:</strong> ${params.totalActive}</p>
      ${params.overdueCount > 0 ? `<p style="color:#dc2626"><strong>🚨 Gecikmiş:</strong> ${params.overdueCount}</p>` : ''}
      ${params.dueTodayCount > 0 ? `<p><strong>⏰ Bugün Bitmeli:</strong> ${params.dueTodayCount}</p>` : ''}
      ${params.blockedCount > 0 ? `<p><strong>🚫 Engelli:</strong> ${params.blockedCount}</p>` : ''}
      ${params.delegatableCount > 0 ? `<p><strong>🤝 Delege Edilebilir:</strong> ${params.delegatableCount}</p>` : ''}
    </div>
    ${params.taskSummaryHtml}
    <div style="text-align:center;">
      <a href="${params.adminUrl}" class="cta">Görevleri Görüntüle</a>
    </div>
  `);
  return { subject, html };
}

// =========================================================
// Proposal Sent (→ Client)
// =========================================================
export function proposalSentEmail(params: {
  recipientName: string;
  companyName: string;
  projectTitle: string;
  proposalNumber: string;
  grandTotal: string;
  validityDays: number;
  shareUrl: string;
  senderName: string;
  servicesSummary?: string;
}): { subject: string; html: string } {
  const subject = `${params.companyName} — Hizmet Teklifiniz Hazir (#${params.proposalNumber})`;
  const html = wrapHtml(subject, `
    <span class="badge badge-blue">Hizmet Teklifi</span>
    <p>Sayin <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.senderName}</strong> olarak sizin icin hazirlanan hizmet teklifini ilginize sunariz.</p>
    <div class="metadata">
      <p><strong>Teklif No:</strong> ${params.proposalNumber}</p>
      <p><strong>Proje:</strong> ${params.projectTitle}</p>
      ${params.servicesSummary ? `<p><strong>Hizmetler:</strong> ${params.servicesSummary}</p>` : ''}
      <p><strong>Toplam Tutar:</strong> ${params.grandTotal} TL (KDV dahil)</p>
      <p><strong>Gecerlilik:</strong> ${params.validityDays} gun</p>
    </div>
    <p>Teklifin detaylarini incelemek icin asagidaki butona tiklayin:</p>
    <div style="text-align:center;">
      <a href="${params.shareUrl}" class="cta">Teklifi Incele</a>
    </div>
    <div class="link-box">
      Link calismazsa bu adresi tarayiciniza kopyalayin:<br>${params.shareUrl}
    </div>
    <hr class="divider">
    <p style="font-size:13px; color:#737373;">Herhangi bir sorunuz varsa dogrudan bu e-postaya yanit verebilirsiniz. Teklifiniz ${params.validityDays} gun boyunca gecerlidir.</p>
  `);
  return { subject, html };
}

// =========================================================
// Marketing: Daily Report + Action Plan
// =========================================================
export interface MarketingActionItem {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  campaignName?: string;
  token?: string;       // present → approve/reject buttons
  actionLabel?: string; // e.g. "Kampanyayı Duraklat"
}

export function marketingDailyReportEmail(params: {
  recipientName: string;
  reportDate: string;
  campaigns: Array<{
    name: string;
    status: string;
    spend?: number;
    impressions?: number;
    clicks?: number;
    ctr?: number;
    roas?: number;
    budgetTotal?: number;
  }>;
  alerts: Array<{ title: string; message: string; severity: string }>;
  actionItems: MarketingActionItem[];
  baseUrl: string;
}): { subject: string; html: string } {
  const { recipientName, reportDate, campaigns, alerts, actionItems, baseUrl } = params;

  const fmt = (n?: number, digits = 0) =>
    n != null ? n.toLocaleString('tr-TR', { maximumFractionDigits: digits }) : '—';

  // Campaign table rows
  const campaignRows = campaigns.length === 0
    ? '<tr><td colspan="6" style="text-align:center;color:#737373;padding:12px">Aktif kampanya bulunamadı</td></tr>'
    : campaigns.map((c) => `
      <tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:8px 4px;font-weight:600;font-size:13px">${c.name}</td>
        <td style="padding:8px 4px;text-align:right;font-size:13px">${c.spend != null ? fmt(c.spend) + ' ₺' : '—'}</td>
        <td style="padding:8px 4px;text-align:right;font-size:13px">${fmt(c.impressions)}</td>
        <td style="padding:8px 4px;text-align:right;font-size:13px">${c.ctr != null ? '%' + fmt(c.ctr, 2) : '—'}</td>
        <td style="padding:8px 4px;text-align:right;font-size:13px">${c.roas != null ? 'x' + fmt(c.roas, 2) : '—'}</td>
        <td style="padding:8px 4px;text-align:center;font-size:12px">
          <span style="background:${c.status === 'active' ? '#d1fae5' : '#fee2e2'};color:${c.status === 'active' ? '#065f46' : '#991b1b'};padding:2px 8px;border-radius:100px">${c.status === 'active' ? 'Aktif' : 'Duraklatıldı'}</span>
        </td>
      </tr>`).join('');

  // Alerts section
  const alertsHtml = alerts.length === 0 ? '' : `
    <h3 style="color:#991b1b;font-size:15px;margin:24px 0 8px">🚨 Alarmlar</h3>
    ${alerts.map((a) => `
      <div style="background:${a.severity === 'critical' ? '#fee2e2' : '#fef3c7'};border-left:4px solid ${a.severity === 'critical' ? '#dc2626' : '#d97706'};padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:8px;font-size:13px">
        <strong>${a.title}</strong><br>${a.message}
      </div>`).join('')}`;

  // Action items
  const actionHtml = actionItems.length === 0 ? '<p style="color:#737373;font-size:13px">Bugün önerilen aksiyon yok.</p>' :
    actionItems.map((item, i) => {
      const impactColor = item.impact === 'high' ? '#dc2626' : item.impact === 'medium' ? '#d97706' : '#059669';
      const impactLabel = item.impact === 'high' ? 'Yüksek Öncelik' : item.impact === 'medium' ? 'Orta Öncelik' : 'Düşük Öncelik';
      const buttons = item.token ? `
        <div style="margin-top:10px">
          <a href="${baseUrl}/api/marketing/approve-action?token=${item.token}&decision=approve" style="display:inline-block;background:#171717;color:white;text-decoration:none;padding:8px 18px;border-radius:100px;font-size:13px;font-weight:600;margin-right:8px">✅ ${item.actionLabel || 'Onayla'}</a>
          <a href="${baseUrl}/api/marketing/approve-action?token=${item.token}&decision=reject" style="display:inline-block;background:white;color:#171717;text-decoration:none;padding:7px 18px;border-radius:100px;font-size:13px;font-weight:600;border:1.5px solid #e5e5e5">❌ Atla</a>
        </div>` : `<p style="font-size:12px;color:#737373;margin-top:6px">ℹ️ Manuel aksiyon gerektirir</p>`;
      return `
        <div style="border:1px solid #e5e5e5;border-radius:10px;padding:14px 16px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:14px;font-weight:700;color:#171717">${i + 1}. ${item.title}</span>
            <span style="background:${impactColor}1a;color:${impactColor};font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px">${impactLabel}</span>
          </div>
          ${item.campaignName ? `<p style="font-size:12px;color:#737373;margin:2px 0">📍 ${item.campaignName}</p>` : ''}
          <p style="font-size:13px;color:#404040;margin:6px 0 0">${item.description}</p>
          ${buttons}
        </div>`;
    }).join('');

  const subject = `📊 Marketing Raporu — ${reportDate}`;
  const html = wrapHtml(subject, `
    <span class="badge badge-blue">Günlük Rapor</span>
    <p>Merhaba <strong>${recipientName}</strong>,</p>
    <p>İşte <strong>${reportDate}</strong> tarihli kampanya özeti ve aksiyon önerileri:</p>

    <h3 style="font-size:15px;margin:20px 0 10px">📈 Kampanya Özeti (Son 7 Gün)</h3>
    <table style="width:100%;border-collapse:collapse;font-family:inherit">
      <thead>
        <tr style="border-bottom:2px solid #171717">
          <th style="padding:8px 4px;text-align:left;font-size:12px;color:#737373">Kampanya</th>
          <th style="padding:8px 4px;text-align:right;font-size:12px;color:#737373">Harcama</th>
          <th style="padding:8px 4px;text-align:right;font-size:12px;color:#737373">Gösterim</th>
          <th style="padding:8px 4px;text-align:right;font-size:12px;color:#737373">CTR</th>
          <th style="padding:8px 4px;text-align:right;font-size:12px;color:#737373">ROAS</th>
          <th style="padding:8px 4px;text-align:center;font-size:12px;color:#737373">Durum</th>
        </tr>
      </thead>
      <tbody>${campaignRows}</tbody>
    </table>

    ${alertsHtml}

    <h3 style="font-size:15px;margin:24px 0 10px">💡 Aksiyon Planı</h3>
    ${actionHtml}

    <hr class="divider">
    <p style="font-size:12px;color:#737373">Onay gerektiren aksiyonlar 48 saat geçerlidir. Tüm bütçe değişiklikleri onayınız olmadan gerçekleşmez.</p>
    <div style="text-align:center;margin-top:16px">
      <a href="${baseUrl}/admin/marketing" class="cta-outline">Marketing Paneline Git</a>
    </div>
  `);
  return { subject, html };
}

export function wizardInvitationEmail(params: {
  recipientName: string;
  businessName: string;
  sectorLabel: string;
  wizardUrl: string;
  senderName: string;
}): { subject: string; html: string } {
  const subject = `${params.businessName} için marka stratejisi analizi hazır`;
  const html = wrapHtml(subject, `
    <span class="badge badge-blue">Strateji Daveti</span>
    <p>Merhaba <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.senderName}</strong> olarak <strong>${params.businessName}</strong> için özel bir marka stratejisi analizi hazırladık.</p>
    <p>Sektörünüze (<strong>${params.sectorLabel}</strong>) özel sorularla markanızın dijital stratejisini birlikte şekillendirelim. Bu kısa analiz formu yaklaşık <strong>8-10 dakika</strong> sürmektedir.</p>
    <div class="metadata">
      <p><strong>İşletme:</strong> ${params.businessName}</p>
      <p><strong>Sektör:</strong> ${params.sectorLabel}</p>
      <p><strong>Süre:</strong> ~8-10 dakika</p>
    </div>
    <p>Stratejik analiz formunu doldurmak için aşağıdaki butona tıklayın:</p>
    <div style="text-align:center;">
      <a href="${params.wizardUrl}" class="cta">Strateji Analizine Başla</a>
    </div>
    <div class="link-box">
      Link çalışmıyorsa bu adresi tarayıcınıza kopyalayın:<br>${params.wizardUrl}
    </div>
    <hr class="divider">
    <p style="font-size:13px; color:#737373;">Bu analiz sonucunda markanızın güçlü yönleri, dijital stratejisi ve sektöre özel öneriler içeren kapsamlı bir rapor hazırlanacaktır.</p>
  `);
  return { subject, html };
}

// =========================================================
// Invoice: New Invoice Notification (→ Customer / Karşı taraf)
// =========================================================
export function invoiceNotificationEmail(params: {
  recipientName: string;
  customerName: string;
  invoiceNumber: string;
  amountLabel: string; // ör: "₺12.500,00" (sembol dahil, formatlı)
  issueDate?: string;
  dueDate?: string;
  description?: string;
  viewUrl: string; // /fatura/:shareToken — güvenli görüntüleme/indirme sayfası
  senderName: string;
}): { subject: string; html: string } {
  const subject = `${params.invoiceNumber} numaralı faturanız (${params.amountLabel})`;
  const html = wrapHtml(subject, `
    <span class="badge badge-blue">Yeni Fatura</span>
    <p>Merhaba <strong>${params.recipientName || params.customerName}</strong>,</p>
    <p><strong>${params.senderName}</strong> tarafından adınıza bir fatura düzenlenmiştir. Fatura detayları aşağıdadır:</p>
    <div class="metadata">
      <p><strong>Fatura No:</strong> ${params.invoiceNumber}</p>
      <p><strong>Tutar:</strong> ${params.amountLabel}</p>
      ${params.issueDate ? `<p><strong>Düzenlenme Tarihi:</strong> ${params.issueDate}</p>` : ''}
      ${params.dueDate ? `<p><strong>Son Ödeme Tarihi:</strong> ${params.dueDate}</p>` : ''}
      ${params.description ? `<p><strong>Açıklama:</strong> ${params.description}</p>` : ''}
    </div>
    <p>Faturanızın PDF belgesini aşağıdaki butondan güvenle görüntüleyebilir ve indirebilirsiniz.</p>
    <div style="text-align:center;">
      <a href="${params.viewUrl}" class="cta">Faturayı Görüntüle ve İndir</a>
    </div>
    <p style="color:#737373;font-size:13px;margin-top:16px;">Bu link size özeldir. Herhangi bir sorunuz olursa bu e-postayı yanıtlayabilirsiniz.</p>
    <div class="link-box">
      Link çalışmıyorsa bu adresi tarayıcınıza kopyalayın:<br>${params.viewUrl}
    </div>
  `);
  return { subject, html };
}
