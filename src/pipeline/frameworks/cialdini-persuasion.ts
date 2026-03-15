// Cialdini's 7 Principles of Persuasion
// Applied to brand messaging layer

export interface CialdiniAssessment {
  reciprocity: { score: number; application: string };      // 0-10: Give first, then ask
  commitment: { score: number; application: string };       // 0-10: Small steps → big commitment
  socialProof: { score: number; application: string };      // 0-10: Others are doing it
  authority: { score: number; application: string };        // 0-10: Expert endorsement
  liking: { score: number; application: string };           // 0-10: People buy from people they like
  scarcity: { score: number; application: string };         // 0-10: Limited availability
  unity: { score: number; application: string };            // 0-10: "We are the same tribe"
}

export interface EthicalGuardrail {
  principle: string;
  ethicalUse: string;
  manipulativeUse: string;
  boundary: string;
}

export const ETHICAL_GUARDRAILS: EthicalGuardrail[] = [
  {
    principle: 'Kıtlık',
    ethicalUse: 'Gerçekten sınırlı stokta olan ürünün durumunu bildirmek',
    manipulativeUse: 'Sahte aciliyet yaratmak, yapay stok sınırlaması',
    boundary: 'Kıtlık iddiası gerçek ve doğrulanabilir olmalı',
  },
  {
    principle: 'Sosyal Kanıt',
    ethicalUse: 'Gerçek müşteri yorumları ve başarı hikayeleri',
    manipulativeUse: 'Sahte yorumlar, uydurma istatistikler',
    boundary: 'Tüm sosyal kanıtlar doğrulanabilir kaynaktan gelmeli',
  },
  {
    principle: 'Otorite',
    ethicalUse: 'Gerçek uzmanlık ve sertifikasyonları vurgulamak',
    manipulativeUse: 'Sahte ünvanlar, yanıltıcı onaylar',
    boundary: 'Otorite iddiaları kanıtlanabilir olmalı',
  },
];

export const CIALDINI_PROMPT_SNIPPET = `
## Cialdini 7 İkna Prensibi — Mesajlama Katmanı
Her prensip için marka mesajlamasında nasıl kullanılacağını belirle (0-10 puan + uygulama):

1. **Karşılıklılık (Reciprocity):** Önce değer ver, sonra iste. Ücretsiz içerik, deneme, ipucu.
2. **Tutarlılık (Commitment):** Küçük adımlarla başla. Newsletter → demo → satın alma.
3. **Sosyal Kanıt (Social Proof):** Başkaları yapıyor. Müşteri sayısı, yorumlar, referanslar.
4. **Otorite (Authority):** Uzman onayı. Sertifika, medya, ödüller, endüstri liderliği.
5. **Beğeni (Liking):** Sevilen markalar satar. Hikaye, kişilik, benzerlik.
6. **Kıtlık (Scarcity):** Sınırlı erişim. Mevsimsel, stok, erken kuş.
7. **Birlik (Unity):** "Biz" hissi. Topluluk, kimlik, aidiyet.

**ETİK KONTROL:** Her prensip için MANIPÜLASYON sınırını belirt.
Markanın bu prensibi etik sınırlar içinde kullanıp kullanmadığını değerlendir.
`;
