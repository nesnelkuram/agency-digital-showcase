export type ExportProfile =
  | "manufacturer"
  | "seller"
  | "exploring"
  | "unspecified";
export type ExportConsentStatus =
  | "not_requested"
  | "pending"
  | "subscribed"
  | "unsubscribed";

export const EXPORT_PROFILE_LABELS: Record<ExportProfile, string> = {
  manufacturer: "Üreticiyim",
  seller: "Satıcıyım / ihracat yapıyorum",
  exploring: "Başlamayı düşünüyorum",
  unspecified: "Belirtilmedi",
};
export const EXPORT_CONSENT_LABELS: Record<ExportConsentStatus, string> = {
  not_requested: "Yalnızca rapor",
  pending: "E-posta onayı bekliyor",
  subscribed: "Pazarlama izni doğrulandı",
  unsubscribed: "İzin geri çekildi",
};

export interface ExportContact {
  id: string;
  email: string;
  name: string;
  profile: ExportProfile;
  sector: string;
  tags: string[];
  createdAt: string;
  verifiedAt: string | null;
  consentStatus: ExportConsentStatus;
  consentVersion: string;
  confirmedAt: string | null;
  source: { source: string; medium: string; campaign: string };
}

export interface ExportAudiencePage {
  contacts: ExportContact[];
  nextCursor: string | null;
  counts: {
    total: number;
    subscribed: number;
    pending: number;
    unsubscribed: number;
  };
}
