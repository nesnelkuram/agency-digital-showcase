import { Timestamp } from 'firebase/firestore';

// ============================================
// UYGULAMA SEED DOSYALARI
// ============================================

export interface AppSeedInfo {
  storageUrl: string;   // 'filing_seeds/intiba/premiere_pro'
  fileName: string;     // 'premiere_blank.prproj'
  size: number;
  updatedAt: Timestamp;
}

export type AppSeedsMap = Record<string, AppSeedInfo>;

// ============================================
// DOSYALAMA DURUMLARI
// ============================================

export type FilingProjectStatus = 'created' | 'archived';

export const FILING_STATUS_LABELS: Record<FilingProjectStatus, string> = {
  created: 'Olusturuldu',
  archived: 'Arsivlendi',
};

export const FILING_STATUS_COLORS: Record<FilingProjectStatus, string> = {
  created: 'bg-green-100 text-green-700',
  archived: 'bg-neutral-100 text-neutral-600',
};

// ============================================
// DOSYALAMA SABLON YAPISI
// ============================================

export interface FilingTemplateFolder {
  id: string;
  name: string;          // "01_Project_Files"
  parentId?: string;     // Ic ice klasorler icin
  order: number;
}

export interface FilingTemplateFile {
  id: string;
  name: string;          // "[template].prproj"
  folderId: string;      // Hangi klasorde olacak
  storageUrl: string;    // Firebase Storage'daki sablon dosya (bos dosyalarda '')
  size: number;
  order: number;
  isBlank?: boolean;     // true = Storage'dan indirme, proje olusturulunca bos dosya yarat
}

export interface FilingTemplate {
  id: string;
  name: string;           // "Video Editing Template"
  description?: string;
  folders: FilingTemplateFolder[];
  files: FilingTemplateFile[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// DOSYALAMA PROJE KAYDI
// ============================================

export interface FilingProject {
  id: string;
  projectNumber: string;      // "0004"
  clientName: string;
  projectName: string;
  date: string;               // "2026-02-17"
  editor: string;
  templateId: string;
  templateName: string;

  // Olusan klasor bilgisi
  folderName: string;         // "0004_Selen Magazcioglu_Sevgililer Gunu_2026-02-17_intiba"
  folderPath?: string;        // Lokal path (opsiyonel)
  hardDisk?: string;          // Kullanicinin sectigi harddisk etiketi

  // Durum
  status: FilingProjectStatus;
  notes?: string;

  // Link to project system (optional)
  projectId?: string;

  // Audit
  tenantId: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// CRUD TIPLERI
// ============================================

export interface CreateFilingProjectData {
  clientName: string;
  projectName: string;
  date: string;
  editor: string;
  templateId: string;
  templateName: string;
  hardDisk?: string;
  folderPath?: string;
  notes?: string;
  projectId?: string;
}

export interface UpdateFilingProjectData {
  status?: FilingProjectStatus;
  notes?: string;
  hardDisk?: string;
  folderPath?: string;
}

export interface CreateFilingTemplateData {
  name: string;
  description?: string;
  folders: Omit<FilingTemplateFolder, 'id'>[];
}

export interface UpdateFilingTemplateData {
  name?: string;
  description?: string;
  folders?: FilingTemplateFolder[];
  files?: FilingTemplateFile[];
}

// ============================================
// SAYAC (Auto-increment proje numarasi)
// ============================================

export interface FilingCounter {
  lastNumber: number;   // 4 -> sonraki 5 olacak
  prefix?: string;      // Opsiyonel onek
}

// ============================================
// FILTRE TIPI
// ============================================

export interface FilingProjectFilters {
  status?: FilingProjectStatus[];
  editor?: string;
  templateId?: string;
  search?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}
