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
}): { subject: string; html: string } {
  const subject = `${params.senderName} içerik planınızı onayınıza sundu`;
  const html = wrapHtml(subject, `
    <span class="badge badge-amber">Onay Bekleniyor</span>
    <p>Merhaba <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.senderName}</strong> aşağıdaki içerik planını sizin onayınıza sundu:</p>
    <div class="metadata">
      <p><strong>Plan Adı:</strong> ${params.planTitle}</p>
      ${params.weekRange ? `<p><strong>Dönem:</strong> ${params.weekRange}</p>` : ''}
    </div>
    <p>Planı incelemek ve onaylamak için aşağıdaki butona tıklayın:</p>
    <div style="text-align:center;">
      <a href="${params.shareUrl}" class="cta">Planı İncele ve Onayla</a>
    </div>
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
