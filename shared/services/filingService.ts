import {
  collection,
  doc,
  addDoc,
  setDoc,
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
  runTransaction,
  deleteField,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import type {
  FilingProject,
  FilingTemplate,
  FilingTemplateFolder,
  FilingTemplateFile,
  CreateFilingProjectData,
  UpdateFilingProjectData,
  CreateFilingTemplateData,
  UpdateFilingTemplateData,
  AppSeedInfo,
  AppSeedsMap,
} from '@/shared/types/filing';

const PROJECTS_COLLECTION = 'filing_projects';
const TEMPLATES_COLLECTION = 'filing_templates';
const COUNTERS_COLLECTION = 'filing_counters';
const CONFIG_COLLECTION = 'filing_config';

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
// PROJE NUMARASI SAYACI
// ============================================

/**
 * Peek at the next project number without incrementing.
 * Used for preview purposes only.
 */
export async function peekNextProjectNumber(tenantId: string): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const counterRef = doc(db, COUNTERS_COLLECTION, tenantId);
  const counterDoc = await getDoc(counterRef);

  let currentNumber = 0;
  if (counterDoc.exists()) {
    currentNumber = counterDoc.data().lastNumber || 0;
  }

  return String(currentNumber + 1).padStart(4, '0');
}

/**
 * Atomically increment and return the next project number.
 * Used only during actual project creation.
 */
export async function getNextProjectNumber(tenantId: string): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const counterRef = doc(db, COUNTERS_COLLECTION, tenantId);

  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let currentNumber = 0;
    if (counterDoc.exists()) {
      currentNumber = counterDoc.data().lastNumber || 0;
    }

    const newNumber = currentNumber + 1;

    transaction.set(counterRef, {
      lastNumber: newNumber,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    return newNumber;
  });

  return String(nextNumber).padStart(4, '0');
}

// ============================================
// DOSYALAMA PROJE CRUD
// ============================================

export async function createFilingProject(
  tenantId: string,
  data: CreateFilingProjectData,
  createdByUid: string,
  createdByName: string
): Promise<{ id: string; projectNumber: string; folderName: string }> {
  if (!db) throw new Error('Firebase not initialized');

  const projectNumber = await getNextProjectNumber(tenantId);
  const now = Timestamp.now();

  const folderName = `${projectNumber}_${data.clientName}_${data.projectName}_${data.date}_${data.editor}`;

  const projectData: Omit<FilingProject, 'id'> = {
    projectNumber,
    clientName: data.clientName,
    projectName: data.projectName,
    date: data.date,
    editor: data.editor,
    templateId: data.templateId,
    templateName: data.templateName,
    folderName,
    folderPath: data.folderPath,
    hardDisk: data.hardDisk,
    status: 'created',
    notes: data.notes,
    projectId: data.projectId,
    tenantId,
    createdBy: createdByUid,
    createdByName,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(
    collection(db, PROJECTS_COLLECTION),
    stripUndefined(projectData)
  );

  return { id: docRef.id, projectNumber, folderName };
}

export async function getFilingProject(
  tenantId: string,
  id: string
): Promise<FilingProject | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, PROJECTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as FilingProject;
}

export async function updateFilingProject(
  tenantId: string,
  id: string,
  data: UpdateFilingProjectData
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, PROJECTS_COLLECTION, id);

  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFilingProject(
  tenantId: string,
  id: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db, PROJECTS_COLLECTION, id));
}

export async function getFilingProjects(
  tenantId: string,
  filters?: FilingProjectFilters,
  pageSize: number = 50,
  lastDoc?: DocumentSnapshot
): Promise<{ projects: FilingProject[]; lastDoc: DocumentSnapshot | null }> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
  ];

  if (filters?.status?.length) {
    constraints.push(where('status', 'in', filters.status));
  }

  if (filters?.editor) {
    constraints.push(where('editor', '==', filters.editor));
  }

  if (filters?.templateId) {
    constraints.push(where('templateId', '==', filters.templateId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  constraints.push(limit(pageSize));

  const q = query(collection(db, PROJECTS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  let projects: FilingProject[] = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  } as FilingProject));

  // Client-side search filter
  if (filters?.search) {
    const term = filters.search.toLowerCase();
    projects = projects.filter(
      (p) =>
        p.projectNumber.includes(term) ||
        p.clientName.toLowerCase().includes(term) ||
        p.projectName.toLowerCase().includes(term) ||
        p.editor.toLowerCase().includes(term) ||
        p.folderName.toLowerCase().includes(term)
    );
  }

  const newLastDoc = snapshot.docs.length > 0
    ? snapshot.docs[snapshot.docs.length - 1]
    : null;

  return { projects, lastDoc: newLastDoc };
}

export async function getFilingStats(tenantId: string): Promise<{
  total: number;
  thisMonth: number;
  editors: Record<string, number>;
  templates: Record<string, number>;
}> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, PROJECTS_COLLECTION),
    where('tenantId', '==', tenantId)
  );
  const snapshot = await getDocs(q);

  const now = new Date();
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const stats = {
    total: 0,
    thisMonth: 0,
    editors: {} as Record<string, number>,
    templates: {} as Record<string, number>,
  };

  snapshot.docs.forEach((d) => {
    const data = d.data();
    stats.total++;

    if (data.date >= thisMonthStart) {
      stats.thisMonth++;
    }

    if (data.editor) {
      stats.editors[data.editor] = (stats.editors[data.editor] || 0) + 1;
    }

    if (data.templateName) {
      stats.templates[data.templateName] = (stats.templates[data.templateName] || 0) + 1;
    }
  });

  return stats;
}

// ============================================
// SABLON CRUD
// ============================================

export async function createFilingTemplate(
  tenantId: string,
  data: CreateFilingTemplateData,
  createdByUid: string
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const now = Timestamp.now();

  const folders: FilingTemplateFolder[] = data.folders.map((f, i) => ({
    ...f,
    id: `folder-${Date.now()}-${i}`,
  }));

  const templateData: Omit<FilingTemplate, 'id'> = {
    name: data.name,
    description: data.description,
    folders,
    files: [],
    createdBy: createdByUid,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(
    collection(db, TEMPLATES_COLLECTION),
    stripUndefined({ tenantId, ...templateData })
  );
  return docRef.id;
}

export async function getFilingTemplates(
  tenantId: string
): Promise<FilingTemplate[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, TEMPLATES_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  } as FilingTemplate));
}

export async function getFilingTemplate(
  tenantId: string,
  id: string
): Promise<FilingTemplate | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, TEMPLATES_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as FilingTemplate;
}

export async function updateFilingTemplate(
  tenantId: string,
  id: string,
  data: UpdateFilingTemplateData
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, TEMPLATES_COLLECTION, id);

  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFilingTemplate(
  tenantId: string,
  id: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  // Delete template files from Storage
  const template = await getFilingTemplate(tenantId, id);
  if (template && storage) {
    for (const file of template.files) {
      try {
        const fileRef = ref(storage, file.storageUrl);
        await deleteObject(fileRef);
      } catch {
        // File may already be deleted
      }
    }
  }

  await deleteDoc(doc(db, TEMPLATES_COLLECTION, id));
}

export async function addBlankTemplateFile(
  tenantId: string,
  templateId: string,
  folderId: string,
  fileName: string,
  seedUrl?: string
): Promise<FilingTemplateFile> {
  if (!db) throw new Error('Firebase not initialized');

  const template = await getFilingTemplate(tenantId, templateId);
  if (!template) throw new Error('Template not found');

  const templateFile: FilingTemplateFile = {
    id: `file-${Date.now()}`,
    name: fileName,
    folderId,
    storageUrl: seedUrl || '',
    size: 0,
    order: template.files.length,
    isBlank: !seedUrl,
  };

  const updatedFiles = [...template.files, templateFile];

  await updateDoc(doc(db, TEMPLATES_COLLECTION, templateId), {
    files: updatedFiles,
    updatedAt: serverTimestamp(),
  });

  return templateFile;
}

// ============================================
// UYGULAMA SEED DOSYALARI
// ============================================

export async function getAppSeeds(tenantId: string): Promise<AppSeedsMap> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, CONFIG_COLLECTION, tenantId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return {};
  return (docSnap.data().appSeeds || {}) as AppSeedsMap;
}

export async function uploadAppSeed(
  tenantId: string,
  presetKey: string,
  file: File
): Promise<AppSeedInfo> {
  if (!db || !storage) throw new Error('Firebase not initialized');

  const storagePath = `filing_seeds/${tenantId}/${presetKey}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);

  const seedInfo: AppSeedInfo = {
    storageUrl: storagePath,
    fileName: file.name,
    size: file.size,
    updatedAt: Timestamp.now(),
  };

  const configRef = doc(db, CONFIG_COLLECTION, tenantId);
  await setDoc(configRef, { appSeeds: { [presetKey]: seedInfo } }, { merge: true });

  return seedInfo;
}

export async function deleteAppSeed(
  tenantId: string,
  presetKey: string
): Promise<void> {
  if (!db || !storage) throw new Error('Firebase not initialized');

  try {
    const storageRef = ref(storage, `filing_seeds/${tenantId}/${presetKey}`);
    await deleteObject(storageRef);
  } catch {
    // May already be deleted
  }

  const configRef = doc(db, CONFIG_COLLECTION, tenantId);
  await updateDoc(configRef, { [`appSeeds.${presetKey}`]: deleteField() });
}

export async function uploadTemplateFile(
  tenantId: string,
  templateId: string,
  folderId: string,
  file: File
): Promise<FilingTemplateFile> {
  if (!db || !storage) throw new Error('Firebase not initialized');

  const storagePath = `filing_templates/${tenantId}/${templateId}/${file.name}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);

  const templateFile: FilingTemplateFile = {
    id: `file-${Date.now()}`,
    name: file.name,
    folderId,
    storageUrl: storagePath,
    size: file.size,
    order: 0,
  };

  // Update template with new file
  const template = await getFilingTemplate(tenantId, templateId);
  if (!template) throw new Error('Template not found');

  const updatedFiles = [...template.files, templateFile];

  await updateDoc(doc(db, TEMPLATES_COLLECTION, templateId), {
    files: updatedFiles,
    updatedAt: serverTimestamp(),
  });

  return templateFile;
}

export async function deleteTemplateFile(
  tenantId: string,
  templateId: string,
  fileId: string
): Promise<void> {
  if (!db || !storage) throw new Error('Firebase not initialized');

  const template = await getFilingTemplate(tenantId, templateId);
  if (!template) throw new Error('Template not found');

  const fileToDelete = template.files.find((f) => f.id === fileId);
  if (fileToDelete) {
    try {
      const fileRef = ref(storage, fileToDelete.storageUrl);
      await deleteObject(fileRef);
    } catch {
      // File may already be deleted
    }
  }

  const updatedFiles = template.files.filter((f) => f.id !== fileId);

  await updateDoc(doc(db, TEMPLATES_COLLECTION, templateId), {
    files: updatedFiles,
    updatedAt: serverTimestamp(),
  });
}
