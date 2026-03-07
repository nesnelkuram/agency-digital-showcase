import { Timestamp } from 'firebase/firestore';
import { ServiceCategory } from './pricing/services';

// ============================================
// PROJE DURUMLARI
// ============================================

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Aktif',
  paused: 'Duraklatildi',
  completed: 'Tamamlandi',
  cancelled: 'Iptal Edildi',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

// ============================================
// PROJE HIZMETI (Her hizmet modulu icin)
// ============================================

export type ProjectServiceStatus = 'active' | 'paused' | 'not_started' | 'completed';

export const PROJECT_SERVICE_STATUS_LABELS: Record<ProjectServiceStatus, string> = {
  active: 'Aktif',
  paused: 'Duraklatildi',
  not_started: 'Baslamadi',
  completed: 'Tamamlandi',
};

export const PROJECT_SERVICE_STATUS_COLORS: Record<ProjectServiceStatus, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  not_started: 'bg-gray-100 text-gray-500',
  completed: 'bg-blue-100 text-blue-700',
};

export interface ProjectService {
  category: ServiceCategory;
  status: ProjectServiceStatus;
  activatedAt?: Timestamp;
  notes?: string;
  metadata?: Record<string, any>;
  linkedWorkflowTemplateIds?: string[];
}

// ============================================
// PROJE TIMELINE
// ============================================

export type ProjectTimelineEventType =
  | 'created'
  | 'status_change'
  | 'service_activated'
  | 'service_deactivated'
  | 'service_status_change'
  | 'note'
  | 'quote_linked'
  | 'client_assigned';

export interface ProjectTimelineEvent {
  id: string;
  type: ProjectTimelineEventType;
  title: string;
  description?: string;
  createdAt: Timestamp;
  createdBy: string;
  createdByName?: string;
  metadata?: Record<string, any>;
}

// ============================================
// ANA PROJE ENTITY
// ============================================

export interface Project {
  id: string;

  // Temel bilgi
  name: string;
  description?: string;
  status: ProjectStatus;

  // Musteri iliskisi
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;

  // Lead/Teklif kaynagi
  leadId?: string;
  quoteId?: string;

  // Hizmetler (projenin kalbi)
  services: ProjectService[];

  // Takim
  assignedTo?: string;
  assignedToName?: string;
  teamMembers?: Array<{
    uid: string;
    name: string;
    role: string;
  }>;

  // Finansal
  totalBudget?: number;
  monthlyFee?: number;
  currency?: 'TRY' | 'USD' | 'EUR';

  // Tarihler
  startDate?: Timestamp;
  endDate?: Timestamp;

  // Timeline
  timeline: ProjectTimelineEvent[];

  // Etiketler ve notlar
  tags: string[];
  internalNotes?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  createdByName: string;
}

// ============================================
// CRUD TIPLERI
// ============================================

export interface CreateProjectData {
  name: string;
  description?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  clientId?: string;
  leadId?: string;
  quoteId?: string;
  services: ProjectService[];
  totalBudget?: number;
  monthlyFee?: number;
  currency?: 'TRY' | 'USD' | 'EUR';
  startDate?: Timestamp;
  endDate?: Timestamp;
  tags?: string[];
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  assignedTo?: string;
  assignedToName?: string;
  totalBudget?: number;
  monthlyFee?: number;
  currency?: 'TRY' | 'USD' | 'EUR';
  startDate?: Timestamp;
  endDate?: Timestamp;
  tags?: string[];
  internalNotes?: string;
}

// ============================================
// LISTE/OZET TIPI
// ============================================

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  clientName: string;
  clientCompany?: string;
  activeServicesCount: number;
  serviceCategories: ServiceCategory[];
  assignedToName?: string;
  totalBudget?: number;
  monthlyFee?: number;
  startDate?: Timestamp;
  createdAt: Timestamp;
}

// ============================================
// FILTRE TIPI
// ============================================

export interface ProjectFilters {
  status?: ProjectStatus[];
  serviceCategory?: ServiceCategory[];
  assignedTo?: string;
  clientId?: string;
  search?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}
