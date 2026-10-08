export const ODAGI_NOTICE_VERSION = '2026-09-12-v2';
export const ODAGI_CONSENT_TEXT = 'Başvurumun değerlendirilmesi için paylaştığım bilgilerin İntiba tarafından kaydedilmesini ve bu başvuru hakkında e-posta ile iletişime geçilmesini kabul ediyorum.';

export const ODAGI_LABELS: Record<string, string> = {
  name: 'Ad soyad', email: 'E-posta', city: 'İl / şehir', district: 'İlçe',
  neighborhood: 'Mahalle', area: 'Kullanılabilir alan (m²)', occupation: 'Meslek',
  employed: 'Sigortalı çalışma', ownsSpace: 'Alanın mülkiyeti', company: 'Faturalama durumu',
  daytimeAvailable: 'Gün içinde uygun kişi', couriers: 'Kargo erişimi',
  petSmoke: 'Evcil hayvan / sigara', roomConditions: 'Odanın koşulları',
  packingSpace: 'Paketleme alanı', investment: 'Ekipman yatırımı',
  roomInfo: 'Alan hakkında bilgi', income: 'Aylık gelir beklentisi',
};
export const ODAGI_VALUES: Record<string, string> = {
  yes: 'Evet', no: 'Hayır', exists: 'Şirketim var', none: 'Yok',
  considering: 'İş birliği netleşirse değerlendirebilirim',
  pets: 'Evcil hayvan var', smoking: 'Sigara kullanılıyor', clear: 'Hiçbiri yok',
  damp: 'Nem / rutubet var', sunlight: 'Yoğun güneş alıyor',
  '5-25': '5.000 – 25.000 ₺', '25-40': '25.000 – 40.000 ₺',
  '40-100': '40.000 – 100.000 ₺', '100+': '100.000 ₺ üzeri',
};
export interface OdagiApplication {
  id: string; reference: string; createdAt: string; status: 'new';
  name: string; email: string; city: string; district: string; neighborhood: string;
  area: number; occupation: string; employed: string; ownsSpace: string; company: string;
  daytimeAvailable: string; couriers: string; petSmoke: string[]; roomConditions: string[];
  packingSpace: string; investment: string; roomInfo: string; income: string;
  applicationConsent: true; noticeVersion: string;
}
export function odagiDisplay(value: unknown): string {
  if (Array.isArray(value)) return value.map(odagiDisplay).join(', ');
  return ODAGI_VALUES[String(value)] || String(value ?? '—');
}
