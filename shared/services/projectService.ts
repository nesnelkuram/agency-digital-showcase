import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  DocumentSnapshot,
  QueryConstraint,
  serverTimestamp,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  Project,
  ProjectSummary,
  ProjectFilters,
  CreateProjectData,
  UpdateProjectData,
  ProjectTimelineEvent,
  ProjectService,
  ProjectServiceStatus,
} from '@/shared/types/project';
import type { ServiceCategory } from '@/shared/types/pricing/services';

const COLLECTION_NAME = 'projects';

function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        result[key] = stripUndefined(val);
      }
    }
    return result;
  }
  return obj;
}

// ============================================
// TEMEL CRUD ISLEMLERI
// ============================================

export async function createProject(
  tenantId: string,
  data: CreateProjectData,
  createdByUid: string,
  createdByName: string
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const now = Timestamp.now();

  const initialTimeline: ProjectTimelineEvent = {
    id: `evt-${Date.now()}`,
    type: 'created',
    title: 'Proje olusturuldu',
    description: `${data.name} projesi olusturuldu`,
    createdAt: now,
    createdBy: createdByUid,
    createdByName,
  };

  const projectData: Omit<Project, 'id'> = {
    name: data.name,
    description: data.description,
    status: 'active',
    clientId: data.clientId,
    clientName: data.clientName,
    clientEmail: data.clientEmail,
    clientPhone: data.clientPhone,
    clientCompany: data.clientCompany,
    leadId: data.leadId,
    quoteId: data.quoteId,
    services: data.services || [],
    totalBudget: data.totalBudget,
    monthlyFee: data.monthlyFee,
    currency: data.currency || 'TRY',
    startDate: data.startDate || now,
    endDate: data.endDate,
    timeline: [initialTimeline],
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now,
    createdBy: createdByUid,
    createdByName,
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), stripUndefined({ tenantId, ...projectData }));
  return docRef.id;
}

export async function getProject(tenantId: string, id: string): Promise<Project | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as Project;
}

export async function updateProject(
  tenantId: string,
  id: string,
  data: UpdateProjectData,
  updatedByUid: string,
  updatedByName: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, id);
  const current = await getProject(tenantId, id);
  if (!current) throw new Error('Project not found');

  const newEvents: ProjectTimelineEvent[] = [];
  const now = Timestamp.now();

  if (data.status && data.status !== current.status) {
    newEvents.push({
      id: `evt-${Date.now()}`,
      type: 'status_change',
      title: 'Durum degisti',
      description: `${current.status} → ${data.status}`,
      createdAt: now,
      createdBy: updatedByUid,
      createdByName: updatedByName,
    });
  }

  await updateDoc(docRef, {
    ...stripUndefined(data),
    timeline: [...current.timeline, ...newEvents],
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProject(tenantId: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

// ============================================
// LISTELEME VE FILTRELEME
// ============================================

export async function getProjects(
  tenantId: string,
  filters?: ProjectFilters,
  pageSize: number = 20,
  lastDoc?: DocumentSnapshot
): Promise<{ projects: ProjectSummary[]; lastDoc: DocumentSnapshot | null }> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [where('tenantId', '==', tenantId)];

  if (filters?.status?.length) {
    constraints.push(where('status', 'in', filters.status));
  }

  if (filters?.assignedTo) {
    constraints.push(where('assignedTo', '==', filters.assignedTo));
  }

  if (filters?.clientId) {
    constraints.push(where('clientId', '==', filters.clientId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  constraints.push(limit(pageSize));

  const q = query(collection(db, COLLECTION_NAME), ...constraints);
  const snapshot = await getDocs(q);

  const projects: ProjectSummary[] = snapshot.docs.map((d) => {
    const data = d.data();
    const services = data.services || [];
    const activeServices = services.filter((s: ProjectService) => s.status === 'active');

    return {
      id: d.id,
      name: data.name,
      status: data.status,
      clientName: data.clientName,
      clientCompany: data.clientCompany,
      activeServicesCount: activeServices.length,
      serviceCategories: services.map((s: ProjectService) => s.category),
      assignedToName: data.assignedToName,
      totalBudget: data.totalBudget,
      monthlyFee: data.monthlyFee,
      startDate: data.startDate,
      createdAt: data.createdAt,
    };
  });

  // Client-side search filter
  let filtered = projects;
  if (filters?.search) {
    const term = filters.search.toLowerCase();
    filtered = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.clientName.toLowerCase().includes(term) ||
        (p.clientCompany && p.clientCompany.toLowerCase().includes(term))
    );
  }

  const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  return { projects: filtered, lastDoc: newLastDoc };
}

export async function getProjectStats(tenantId: string): Promise<{
  total: number;
  active: number;
  paused: number;
  completed: number;
  cancelled: number;
}> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(collection(db, COLLECTION_NAME), where('tenantId', '==', tenantId));
  const snapshot = await getDocs(q);

  const stats = { total: 0, active: 0, paused: 0, completed: 0, cancelled: 0 };

  snapshot.docs.forEach((d) => {
    const status = d.data().status;
    stats.total++;
    if (status in stats) {
      (stats as any)[status]++;
    }
  });

  return stats;
}

// ============================================
// HIZMET YONETIMI
// ============================================

export async function activateService(
  tenantId: string,
  projectId: string,
  category: ServiceCategory,
  activatedByUid: string,
  activatedByName: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const project = await getProject(tenantId, projectId);
  if (!project) throw new Error('Project not found');

  const now = Timestamp.now();

  // Servisi bul veya olustur
  const existingIndex = project.services.findIndex((s) => s.category === category);
  const updatedServices = [...project.services];

  if (existingIndex >= 0) {
    updatedServices[existingIndex] = {
      ...updatedServices[existingIndex],
      status: 'active',
      activatedAt: now,
    };
  } else {
    updatedServices.push({
      category,
      status: 'active',
      activatedAt: now,
    });
  }

  const timelineEvent: ProjectTimelineEvent = {
    id: `evt-${Date.now()}`,
    type: 'service_activated',
    title: 'Hizmet aktive edildi',
    description: `${category} hizmeti aktive edildi`,
    createdAt: now,
    createdBy: activatedByUid,
    createdByName: activatedByName,
  };

  const docRef = doc(db, COLLECTION_NAME, projectId);
  await updateDoc(docRef, {
    services: stripUndefined(updatedServices),
    timeline: [...project.timeline, timelineEvent],
    updatedAt: serverTimestamp(),
  });
}

export async function deactivateService(
  tenantId: string,
  projectId: string,
  category: ServiceCategory,
  deactivatedByUid: string,
  deactivatedByName: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const project = await getProject(tenantId, projectId);
  if (!project) throw new Error('Project not found');

  const now = Timestamp.now();

  const updatedServices = project.services.map((s) =>
    s.category === category ? { ...s, status: 'completed' as ProjectServiceStatus } : s
  );

  const timelineEvent: ProjectTimelineEvent = {
    id: `evt-${Date.now()}`,
    type: 'service_deactivated',
    title: 'Hizmet tamamlandi',
    description: `${category} hizmeti tamamlandi`,
    createdAt: now,
    createdBy: deactivatedByUid,
    createdByName: deactivatedByName,
  };

  const docRef = doc(db, COLLECTION_NAME, projectId);
  await updateDoc(docRef, {
    services: stripUndefined(updatedServices),
    timeline: [...project.timeline, timelineEvent],
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// TEKLIF -> PROJE DONUSUMU
// ============================================

export async function convertQuoteToProject(
  tenantId: string,
  quoteId: string,
  additionalData: Partial<CreateProjectData>,
  convertedByUid: string,
  convertedByName: string
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  // 1. Teklifi fetch et
  const quoteRef = doc(db, 'quotes', quoteId);
  const quoteSnap = await getDoc(quoteRef);
  if (!quoteSnap.exists()) throw new Error('Quote not found');
  const quoteData = quoteSnap.data();

  // 2. Teklif bilgilerinden proje verisi olustur
  const serviceCategories = new Set<ServiceCategory>();
  (quoteData.items || []).forEach((item: any) => {
    if (item.serviceCategory) {
      serviceCategories.add(item.serviceCategory);
    }
  });

  const now = Timestamp.now();
  const services: ProjectService[] = Array.from(serviceCategories).map((cat) => ({
    category: cat,
    status: 'active' as const,
    activatedAt: now,
  }));

  const projectData: CreateProjectData = {
    name: additionalData.name || quoteData.projectTitle || `${quoteData.clientName} Projesi`,
    description: additionalData.description || quoteData.projectDescription,
    clientName: quoteData.clientName,
    clientEmail: quoteData.clientEmail,
    clientPhone: quoteData.clientPhone,
    clientCompany: quoteData.clientCompany,
    clientId: quoteData.clientId,
    leadId: quoteData.leadId,
    quoteId,
    services: additionalData.services || services,
    totalBudget: quoteData.sellPrice,
    monthlyFee: quoteData.billingType === 'recurring' ? quoteData.sellPrice : undefined,
    ...additionalData,
  };

  // 3. Atomic batch: Proje olustur + Quote guncelle
  const batch = writeBatch(db);

  // Proje doc
  const projectRef = doc(collection(db, COLLECTION_NAME));
  const initialTimeline: ProjectTimelineEvent = {
    id: `evt-${Date.now()}`,
    type: 'created',
    title: 'Proje olusturuldu',
    description: `Teklif #${quoteId.slice(0, 8)} onaylanarak projeye donusturuldu`,
    createdAt: now,
    createdBy: convertedByUid,
    createdByName: convertedByName,
    metadata: { quoteId },
  };

  batch.set(projectRef, stripUndefined({
    tenantId,
    name: projectData.name,
    description: projectData.description,
    status: 'active',
    clientId: projectData.clientId,
    clientName: projectData.clientName,
    clientEmail: projectData.clientEmail,
    clientPhone: projectData.clientPhone,
    clientCompany: projectData.clientCompany,
    leadId: projectData.leadId,
    quoteId: projectData.quoteId,
    services: projectData.services,
    totalBudget: projectData.totalBudget,
    monthlyFee: projectData.monthlyFee,
    currency: 'TRY',
    startDate: now,
    timeline: [initialTimeline],
    tags: [],
    createdAt: now,
    updatedAt: now,
    createdBy: convertedByUid,
    createdByName: convertedByName,
  }));

  // Quote guncelle
  batch.update(quoteRef, {
    status: 'converted',
    projectId: projectRef.id,
    updatedAt: serverTimestamp(),
  });

  // BrandLead guncelle (varsa)
  if (quoteData.leadId) {
    const leadRef = doc(db, 'brand_leads', quoteData.leadId);
    batch.update(leadRef, {
      projectId: projectRef.id,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return projectRef.id;
}

// ============================================
// MUSTERI BAZLI SORGULAMA
// ============================================

export async function getProjectsByClient(
  tenantId: string,
  clientId: string
): Promise<ProjectSummary[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, COLLECTION_NAME),
    where('tenantId', '==', tenantId),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    const services = data.services || [];
    const activeServices = services.filter((s: ProjectService) => s.status === 'active');

    return {
      id: d.id,
      name: data.name,
      status: data.status,
      clientName: data.clientName,
      clientCompany: data.clientCompany,
      activeServicesCount: activeServices.length,
      serviceCategories: services.map((s: ProjectService) => s.category),
      assignedToName: data.assignedToName,
      totalBudget: data.totalBudget,
      monthlyFee: data.monthlyFee,
      startDate: data.startDate,
      createdAt: data.createdAt,
    };
  });
}

// ============================================
// TIMELINE EVENT EKLEME
// ============================================

export async function addTimelineEvent(
  tenantId: string,
  projectId: string,
  event: Omit<ProjectTimelineEvent, 'id' | 'createdAt'>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const project = await getProject(tenantId, projectId);
  if (!project) throw new Error('Project not found');

  const timelineEvent: ProjectTimelineEvent = {
    ...event,
    id: `evt-${Date.now()}`,
    createdAt: Timestamp.now(),
  };

  const docRef = doc(db, COLLECTION_NAME, projectId);
  await updateDoc(docRef, {
    timeline: [...project.timeline, timelineEvent],
    updatedAt: serverTimestamp(),
  });
}
