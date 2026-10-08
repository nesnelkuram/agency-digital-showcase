/* No analytics pixels, fingerprinting, or personal data in browser storage. */
const form = document.querySelector("#report-form");
const button = document.querySelector("#submit-button");
const error = document.querySelector("#form-error");
const formContent = document.querySelector("#form-content");
const success = document.querySelector("#form-success");
const query = new URLSearchParams(window.location.search);
const source = {
  source: (query.get("utm_source") || "direct").slice(0, 100),
  medium: (query.get("utm_medium") || "").slice(0, 100),
  campaign: (query.get("utm_campaign") || "").slice(0, 100),
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (button.disabled || !form.reportValidity()) return;
  const data = new FormData(form);
  const payload = {
    email: data.get("email"),
    name: data.get("name"),
    profile: data.get("profile"),
    sector: data.get("sector"),
    website: data.get("website"),
    privacyAcknowledged: data.get("privacyAcknowledged") === "on",
    marketingConsent: data.get("marketingConsent") === "on",
    source,
  };
  error.hidden = true;
  button.disabled = true;
  button.querySelector("span").textContent = "Gönderiliyor…";
  form.setAttribute("aria-busy", "true");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch("/api/export-research/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || result.success !== true)
      throw new Error(
        result.error || "Gönderim tamamlanamadı. Lütfen tekrar dene.",
      );
    document.querySelector("#success-consent").textContent =
      payload.marketingConsent
        ? "Yeni içerikler için e-postadaki tercih doğrulama bağlantısını da kullan. PDF’yi indirmek seni otomatik olarak bültene eklemez."
        : "Yalnızca istediğin rapor gönderildi. Yeni içerik ve tanıtım e-postaları için izin vermedin.";
    formContent.hidden = true;
    success.hidden = false;
    success.focus({ preventScroll: true });
    form.reset();
  } catch (failure) {
    error.textContent =
      failure.name === "AbortError"
        ? "Yanıt biraz gecikti. Önce e-posta kutunu kontrol et; rapor gelmediyse biraz sonra tekrar dene."
        : failure instanceof TypeError || failure instanceof SyntaxError
          ? "Sunucuya bağlanamadık. İnternet bağlantını kontrol edip tekrar dene."
          : failure.message;
    error.hidden = false;
  } finally {
    window.clearTimeout(timeout);
    button.disabled = false;
    button.querySelector("span").textContent = "PDF raporunu gönder";
    form.removeAttribute("aria-busy");
  }
});
document.querySelector("#try-again").addEventListener("click", () => {
  success.hidden = true;
  formContent.hidden = false;
  document.querySelector("#email").focus();
});

const scenarios = [
  [5.23, 1.92],
  [4.33, 0.47],
  [4.98, 0],
  [5.27, 2.16],
  [6.92, 3],
];
const dollars = (value) => "$" + value.toFixed(2).replace(".", ",");
document
  .querySelector("#product-choice")
  .addEventListener("change", (event) => {
    const [base, stress] = scenarios[Number(event.target.value)];
    document.querySelector("#base-price").textContent = dollars(base);
    document.querySelector("#stress-price").textContent = dollars(stress);
  });
