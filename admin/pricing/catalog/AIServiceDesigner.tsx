import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import ServiceDesignChat from './components/ServiceDesignChat';
import ServiceDesignPreview from './components/ServiceDesignPreview';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import type { ServiceTemplate } from '@/shared/types/pricing';

const AIServiceDesigner: React.FC = () => {
  const [draft, setDraft] = useState<Partial<ServiceTemplate> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSave = async () => {
    if (!draft || !db) return;
    setSaving(true);
    setSaveError(null);

    try {
      const now = Timestamp.now();
      const templateData = {
        name: draft.name || 'Isimsiz Sablon',
        description: draft.description || '',
        shortDescription: draft.shortDescription || '',
        category: draft.category || 'video_production',
        subType: draft.subType || '',
        tags: draft.tags || [],
        components: draft.components || [],
        minimumPrice: draft.minimumPrice || 0,
        defaultMargin: draft.defaultMargin || 0.30,
        complexityMultiplier: draft.complexityMultiplier || 1.0,
        allowQuickQuote: draft.allowQuickQuote ?? true,
        quickQuoteDefaults: draft.quickQuoteDefaults || { quantity: 1 },
        icon: draft.icon || '',
        isActive: true,
        isPopular: false,
        sortOrder: draft.sortOrder || 0,
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: 'ai-designer',
      };

      const docRef = await addDoc(
        collection(db, 'pricing', 'data', 'serviceCatalog'),
        templateData
      );

      navigate(`/admin/pricing/catalog/${docRef.id}`);
    } catch (err: any) {
      setSaveError(err.message || 'Kaydetme hatasi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/pricing/catalog"
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl md:text-2xl font-grotesk font-bold text-[#171717]">
            AI Hizmet Sablon Tasarimcisi
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {saveError && (
            <span className="font-grotesk text-sm text-red-500">{saveError}</span>
          )}
          <button
            onClick={handleSave}
            disabled={!draft || saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-neutral-300 disabled:text-neutral-500 transition-colors font-commons text-sm font-medium"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Kataloga Kaydet
          </button>
        </div>
      </div>

      {/* Split Panel */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        style={{ height: 'calc(100vh - 180px)' }}
      >
        {/* Chat Panel */}
        <ServiceDesignChat onDraftUpdate={setDraft} />

        {/* Preview Panel */}
        <ServiceDesignPreview draft={draft} />
      </div>
    </div>
  );
};

export default AIServiceDesigner;
