// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (f: string) => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');

describe('Dieci taslak aktarımı yalnız geliştirmede', () => {
  const plans = read('studio/pages/StudioPlansPage.tsx');
  it('Plans sayfasında lazy import ve render import.meta.env.DEV ile korunur', () => {
    expect(plans).toMatch(/const DevDraftImport = import\.meta\.env\.DEV \? lazy\(\(\) => import\('\.\.\/components\/DevDraftImport'\)\) : null;/);
    expect(plans).toMatch(/import\.meta\.env\.DEV && DevDraftImport \?/);
  });
  it('taslak modülleri başka hiçbir production dosyasından import edilmez', () => {
    for (const f of ['studio/StudioApp.tsx', 'studio/StudioLayout.tsx', 'studio/pages/StudioPlanPage.tsx', 'App.tsx', 'studio/components/StudioPostCard.tsx']) {
      const t = read(f);
      expect(t).not.toContain('DevDraftImport');
      expect(t).not.toContain('importDraft');
      expect(t).not.toContain('dietiDraftDevServer');
    }
  });
  it('kaynak sunucusu yalnız serve eklentisidir (build\'e girmez)', () => {
    const cfg = read('vite.config.ts');
    expect(cfg).toMatch(/name: 'dieci-draft-dev-readonly',\s*apply: 'serve'/);
  });
  it('importer servis hesabı/env dosyası okumaz ve herkese açık URL/token üretmez', () => {
    const imp = read('studio/devDraft/importDraft.ts');
    for (const bad of ['firebase-admin', 'GOOGLE_APPLICATION_CREDENTIALS', 'getDownloadURL', 'makePublic', '.env', 'serviceAccount']) expect(imp).not.toContain(bad);
    expect(imp).toContain('uploadBytes');
  });
});
