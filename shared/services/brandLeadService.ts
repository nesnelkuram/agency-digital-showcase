import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
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
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  BrandLead,
  BrandLeadSummary,
  BrandLeadFilters,
  CreateBrandLeadData,
  UpdateBrandLeadData,
  TimelineEvent,
  LeadStatus,
} from '@/shared/types/brandLead';

const COLLECTION_NAME = 'brand_leads';

/**
 * Recursively remove undefined values from an object.
 * Preserves Firestore Timestamp instances.
 */
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
// TEMEL CRUD İŞLEMLERİ
// ============================================

/**
 * Yeni lead oluştur
 */
export async function createBrandLead(
  tenantId: string,
  data: CreateBrandLeadData,
  createdByUid: string,
  createdByName: string
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const timestamp = Date.now();
  const submissionId = `BS-${timestamp}`;

  const initialTimeline: TimelineEvent = {
    id: `evt-${timestamp}`,
    type: 'created',
    title: 'Lead oluşturuldu',
    description: `${data.contact.businessName} için yeni lead kaydı`,
    createdAt: Timestamp.now(),
    createdBy: createdByUid,
    createdByName,
  };

  const leadData: Omit<BrandLead, 'id'> = {
    tenantId,
    sector: data.sector,
    contact: data.contact,
    status: 'new',
    priority: 'medium',
    wizard: data.wizard,
    requestedServices: data.requestedServices,
    timeline: [initialTimeline],
    tags: [],
    source: data.source || 'website_wizard',
    sourceDetail: data.sourceDetail,
    utmSource: data.utmSource,
    utmMedium: data.utmMedium,
    utmCampaign: data.utmCampaign,
    submissionId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), stripUndefined(leadData));
  return docRef.id;
}

/**
 * Website form'undan lead oluştur (anonim)
 * Auth gerektirmez, public endpoint için
 */
export async function createBrandLeadFromWebsite(
  data: CreateBrandLeadData
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const timestamp = Date.now();
  const submissionId = `BS-${timestamp}`;

  const initialTimeline: TimelineEvent = {
    id: `evt-${timestamp}`,
    type: 'created',
    title: 'Website üzerinden başvuru',
    description: `${data.contact.businessName} web sitesi formu üzerinden başvurdu`,
    createdAt: Timestamp.now(),
    createdBy: 'system',
    createdByName: 'Website Form',
  };

  const leadData: Omit<BrandLead, 'id'> = {
    sector: data.sector,
    contact: data.contact,
    status: 'new',
    priority: 'medium',
    wizard: data.wizard,
    requestedServices: data.requestedServices,
    timeline: [initialTimeline],
    tags: [],
    source: 'website_wizard',
    sourceDetail: data.sourceDetail,
    utmSource: data.utmSource,
    utmMedium: data.utmMedium,
    utmCampaign: data.utmCampaign,
    submissionId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), stripUndefined(leadData));
  return docRef.id;
}

/**
 * Lead getir (ID ile)
 */
export async function getBrandLead(tenantId: string, id: string): Promise<BrandLead | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as BrandLead;
}

/**
 * Lead güncelle
 */
export async function updateBrandLead(
  tenantId: string,
  id: string,
  data: UpdateBrandLeadData,
  updatedByUid: string,
  updatedByName: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, id);

  // Mevcut lead'i al
  const currentLead = await getBrandLead(tenantId, id);
  if (!currentLead) throw new Error('Lead not found');

  // Timeline olayları oluştur
  const newEvents: TimelineEvent[] = [];
  const now = Timestamp.now();

  if (data.status && data.status !== currentLead.status) {
    newEvents.push({
      id: `evt-${Date.now()}`,
      type: 'status_change',
      title: 'Durum değişti',
      description: `${currentLead.status} → ${data.status}`,
      createdAt: now,
      createdBy: updatedByUid,
      createdByName: updatedByName,
    });
  }

  if (data.priority && data.priority !== currentLead.priority) {
    newEvents.push({
      id: `evt-${Date.now() + 1}`,
      type: 'priority_change',
      title: 'Öncelik değişti',
      description: `${currentLead.priority} → ${data.priority}`,
      createdAt: now,
      createdBy: updatedByUid,
      createdByName: updatedByName,
    });
  }

  if (data.assignedTo && data.assignedTo !== currentLead.assignedTo) {
    newEvents.push({
      id: `evt-${Date.now() + 2}`,
      type: 'assigned',
      title: 'Atama yapıldı',
      description: `${data.assignedToName || data.assignedTo}'a atandı`,
      createdAt: now,
      createdBy: updatedByUid,
      createdByName: updatedByName,
    });
  }

  if (data.aiAnalysis && !currentLead.aiAnalysis) {
    newEvents.push({
      id: `evt-${Date.now() + 3}`,
      type: 'ai_analysis',
      title: 'AI analizi tamamlandı',
      description: 'Gemini ile marka analizi yapıldı',
      createdAt: now,
      createdBy: updatedByUid,
      createdByName: updatedByName,
    });
  }

  await updateDoc(docRef, {
    ...data,
    timeline: [...currentLead.timeline, ...newEvents],
    updatedAt: serverTimestamp(),
  });
}

/**
 * Lead'e not ekle
 */
export async function addNoteToLead(
  tenantId: string,
  id: string,
  note: string,
  addedByUid: string,
  addedByName: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const lead = await getBrandLead(tenantId, id);
  if (!lead) throw new Error('Lead not found');

  const noteEvent: TimelineEvent = {
    id: `evt-${Date.now()}`,
    type: 'note',
    title: 'Not eklendi',
    description: note,
    createdAt: Timestamp.now(),
    createdBy: addedByUid,
    createdByName: addedByName,
  };

  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    timeline: [...lead.timeline, noteEvent],
    updatedAt: serverTimestamp(),
  });
}

/**
 * Lead sil
 */
export async function deleteBrandLead(tenantId: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

// ============================================
// LİSTELEME VE FİLTRELEME
// ============================================

/**
 * Lead listesi getir (pagination + filtre)
 */
export async function getBrandLeads(
  tenantId: string,
  filters?: BrandLeadFilters,
  pageSize: number = 20,
  lastDoc?: DocumentSnapshot
): Promise<{ leads: BrandLeadSummary[]; lastDoc: DocumentSnapshot | null }> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
  ];

  // Filtreler
  if (filters?.sector?.length) {
    constraints.push(where('sector', 'in', filters.sector));
  }

  if (filters?.status?.length) {
    constraints.push(where('status', 'in', filters.status));
  }

  if (filters?.priority?.length) {
    constraints.push(where('priority', 'in', filters.priority));
  }

  if (filters?.assignedTo) {
    constraints.push(where('assignedTo', '==', filters.assignedTo));
  }

  if (filters?.hasAIAnalysis !== undefined) {
    constraints.push(
      where('aiAnalysis', filters.hasAIAnalysis ? '!=' : '==', null)
    );
  }

  // Sıralama
  constraints.push(orderBy('createdAt', 'desc'));

  // Pagination
  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collection(db, COLLECTION_NAME), ...constraints);
  const snapshot = await getDocs(q);

  const leads: BrandLeadSummary[] = snapshot.docs.map((doc) => {
    const data = doc.data() as Omit<BrandLead, 'id'>;
    return {
      id: doc.id,
      sector: data.sector,
      contact: {
        name: data.contact.name,
        businessName: data.contact.businessName,
        email: data.contact.email,
      },
      status: data.status,
      priority: data.priority,
      requestedServicesCount: data.requestedServices?.length || 0,
      assignedToName: data.assignedToName,
      hasAIAnalysis: !!data.aiAnalysis,
      createdAt: data.createdAt,
    };
  });

  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

  return { leads, lastDoc: newLastDoc };
}

/**
 * İstatistikler
 */
export async function getBrandLeadStats(tenantId: string): Promise<{
  total: number;
  byStatus: Record<LeadStatus, number>;
  newThisWeek: number;
  conversionRate: number;
}> {
  if (!db) throw new Error('Firebase not initialized');

  const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), where('tenantId', '==', tenantId)));

  const byStatus: Record<LeadStatus, number> = {
    new: 0,
    contacted: 0,
    qualified: 0,
    proposal: 0,
    negotiation: 0,
    won: 0,
    lost: 0,
  };

  let newThisWeek = 0;
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  snapshot.docs.forEach((doc) => {
    const data = doc.data() as Omit<BrandLead, 'id'>;
    byStatus[data.status]++;

    if (data.createdAt.toDate() > oneWeekAgo) {
      newThisWeek++;
    }
  });

  const total = snapshot.size;
  const won = byStatus.won;
  const lost = byStatus.lost;
  const conversionRate = won + lost > 0 ? (won / (won + lost)) * 100 : 0;

  return {
    total,
    byStatus,
    newThisWeek,
    conversionRate: Math.round(conversionRate),
  };
}

// ============================================
// DÖNÜŞTÜRME
// ============================================

/**
 * Lead'i müşteriye dönüştür
 */
export async function convertLeadToClient(
  tenantId: string,
  leadId: string,
  clientId: string,
  projectId: string | undefined,
  convertedByUid: string,
  convertedByName: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const lead = await getBrandLead(tenantId, leadId);
  if (!lead) throw new Error('Lead not found');

  const convertEvent: TimelineEvent = {
    id: `evt-${Date.now()}`,
    type: 'converted',
    title: 'Müşteriye dönüştürüldü',
    description: projectId
      ? `Client ID: ${clientId}, Project ID: ${projectId}`
      : `Client ID: ${clientId}`,
    createdAt: Timestamp.now(),
    createdBy: convertedByUid,
    createdByName: convertedByName,
  };

  const docRef = doc(db, COLLECTION_NAME, leadId);
  await updateDoc(docRef, {
    status: 'won',
    convertedToClientAt: serverTimestamp(),
    clientId,
    projectId,
    timeline: [...lead.timeline, convertEvent],
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// RAPOR PAYLAŞIMI
// ============================================

function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/**
 * Lead için rapor paylaşım token'ı oluştur
 */
export async function generateReportShareToken(tenantId: string, leadId: string): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const lead = await getBrandLead(tenantId, leadId);
  if (!lead) throw new Error('Lead not found');
  if (!lead.aiAnalysis) throw new Error('Lead has no AI analysis to share');

  // Mevcut token varsa onu döndür
  if (lead.shareToken) return lead.shareToken;

  const token = generateShareToken();
  const docRef = doc(db, COLLECTION_NAME, leadId);
  await updateDoc(docRef, {
    shareToken: token,
    reportSharedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return token;
}

/**
 * Share token ile lead getir (public erişim)
 */
export async function getBrandLeadByShareToken(token: string): Promise<BrandLead | null> {
  if (!db) throw new Error('Firebase not initialized');
  if (!token || token.length < 8) return null;

  const q = query(
    collection(db, COLLECTION_NAME),
    where('shareToken', '==', token),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  const lead = { id: docSnap.id, ...docSnap.data() } as BrandLead;

  // Analizi olmayan lead paylaşılamaz
  if (!lead.aiAnalysis) return null;

  return lead;
}

/**
 * Rapor paylaşımını iptal et
 */
export async function revokeReportShare(tenantId: string, leadId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, leadId);
  await updateDoc(docRef, {
    shareToken: deleteField(),
    reportSharedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * AI analizini sil
 */
export async function deleteAIAnalysis(tenantId: string, leadId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, leadId);
  await updateDoc(docRef, {
    aiAnalysis: deleteField(),
    analyzedAt: deleteField(),
    analyzedBy: deleteField(),
    updatedAt: serverTimestamp(),
  });
}
