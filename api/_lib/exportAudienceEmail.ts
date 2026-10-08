import type { ReportEmail } from "./exportAudience.js";
import { CONSENT_TEXT } from "./exportAudience.js";

export function htmlEscape(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

export function reportEmailContent(email: ReportEmail) {
  const confirm = email.confirmUrl
    ? `
    <hr style="border:0;border-top:1px solid #ddd;margin:28px 0">
    <h2 style="font-size:21px">Yeni araştırmalar da gelsin mi?</h2>
    <p>Formda yeni içeriklerden haberdar olmak istediğini belirttin. Bültene katılmak için aşağıdaki bağlantıdan e-posta adresini doğrula.</p>
    <p style="font-size:13px;color:#555">${CONSENT_TEXT}</p>
    <p><a href="${htmlEscape(email.confirmUrl)}">E-posta tercihimi doğrula →</a></p>`
    : "";
  return {
    subject: "İstediğin ihracat araştırması burada — 50 ürün, 20 hesap, 5 aday",
    html: `<html lang="tr"><body style="margin:0;background:#f5f3ed;color:#182922;font:16px Arial,sans-serif;line-height:1.7"><div style="max-width:580px;margin:auto;padding:40px 24px">
      <p style="font-weight:bold;font-size:26px">intiba<span style="color:#719347">.</span></p>
      <h1 style="font-size:32px;line-height:1.15">Önce hesabını yapalım.</h1>
      <p>İstediğin ABD tekne aksesuarları araştırması hazır. 50 ürünün taramasını, 20 detaylı maliyet modelini ve teklif istenebilecek 5 adayı raporda bulabilirsin.</p>
      <p><a href="${htmlEscape(email.downloadUrl)}" style="display:inline-block;background:#d9f27f;color:#182922;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">PDF raporunu indir ↓</a></p>
      <p style="font-size:13px;color:#555">İndirme bağlantısı 7 gün geçerli. Rapordaki tutarlar 10 Eylül 2026 tarihli araştırma ve model varsayımlarıdır. Üretici teklifi veya kazanç garantisi değildir.</p>
      ${confirm}
      <hr style="border:0;border-top:1px solid #ddd;margin:28px 0">
      <p style="font-size:12px;color:#555">Bu e-posta, rapor formuna girilen adres için gönderildi. Talep sana ait değilse işlem yapman gerekmez; pazarlama listesine otomatik eklenmezsin.<br>
      <a href="${htmlEscape(email.unsubscribeUrl)}">E-posta iznini geri çek</a> · <a href="${htmlEscape(new URL("/ihracat/gizlilik", email.downloadUrl).href)}">Gizlilik ve veri kullanımı</a><br>intiba · info@intiba.co.uk</p>
    </div></body></html>`,
    text: `İstediğin ABD tekne aksesuarları raporu: ${email.downloadUrl}\nBağlantı 7 gün geçerli.\n${email.confirmUrl ? `Bülten tercihini doğrula: ${email.confirmUrl}\n${CONSENT_TEXT}\n` : ""}İzni geri çek: ${email.unsubscribeUrl}\nintiba · info@intiba.co.uk`,
  };
}
