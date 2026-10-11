// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PERSISTENCE_MATRIX } from '@/studio/feedPlanner/integration/persistenceMatrix';

const root = path.resolve(__dirname, '../../..');

describe('kalıcılık matrisi kaynak kodla uyumlu (iddialar kanıta bağlı)', () => {
  it('her satırın en az bir kanıtı var ve kanıtlar depoda doğrulanır', () => {
    expect(PERSISTENCE_MATRIX.length).toBeGreaterThan(10);
    for (const row of PERSISTENCE_MATRIX) {
      expect(row.evidence.length, row.id).toBeGreaterThan(0);
      for (const ev of row.evidence) {
        const text = fs.readFileSync(path.join(root, ev.file), 'utf8');
        const found = new RegExp(ev.pattern).test(text);
        expect(found, `${row.id}: ${ev.file} /${ev.pattern}/ (${ev.expect})`).toBe(ev.expect === 'present');
      }
    }
  });

  it('kalıcı karşılığı OLMAYAN kavramlar "yok" olarak işaretli; "mevcut" iddiası yalnız gerçekten var olanlar için', () => {
    const status = Object.fromEntries(PERSISTENCE_MATRIX.map((r) => [r.id, r.status]));
    for (const id of ['lock', 'dismiss', 'story-series', 'story-overlay', 'crop', 'catalog-paging', 'canva-templates', 'canva-only']) expect(status[id], id).toBe('yok');
    for (const id of ['draft-post', 'draft-plan', 'reject-suggestion', 'feedback-to-planner']) expect(status[id], id).toBe('mevcut');
    for (const id of ['grid-order', 'undated', 'language', 'reject-post', 'model-access']) expect(status[id], id).toBe('kısmi');
  });

  it('önerilen kalıcı durum şeması canlı kurallarda YOKTUR (öneri dosyası ayrı)', () => {
    expect(fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8')).not.toMatch(/content_plan_planner_state/);
    expect(fs.readFileSync(path.join(root, 'docs/proposals/planner-state.rules'), 'utf8')).toMatch(/DAĞITILMADI/);
  });

  it('iç tutarlılık: kimlikler benzersiz; her satır boşluğu ve mevcut durumu açıkça yazar', () => {
    expect(new Set(PERSISTENCE_MATRIX.map((r) => r.id)).size).toBe(PERSISTENCE_MATRIX.length);
    for (const r of PERSISTENCE_MATRIX) {
      expect(r.existing.length, r.id).toBeGreaterThan(2);
      expect(r.gap.length, r.id).toBeGreaterThan(2);
    }
  });
});
