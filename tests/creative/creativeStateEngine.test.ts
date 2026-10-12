// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as S from '@/studio/feedPlanner/post/creativeState';
import { buildEvidence } from '@/shared/planner/creativeContract';
import { ideasResp, captionResp, checkResp } from './uiFixtures';

// Saf durum motoru: sürüm bağlama, zincir geçersizliği, geç yanıt reddi, insan düzenlemesi korunumu
const B: S.Binding = { assetId: 'a1', cropVersion: 1, sourceVersion: 'sha1~k1' };
const TEXT: any = { text: 'Masadaki makarna tabağı sofraya davet ediyor.', source: 'model', assetId: 'a1', cropVersion: 1, sourceVersion: B.sourceVersion, rev: 3 };
const ent = (r: any): S.Entry => { if (!r.ok) throw new Error(r.why); return r.entry; };
const ideas = () => ent(S.acceptIdeas(S.emptyEntry('p1'), ideasResp(), { binding: B, intentRev: 0 }, B));
const selected = () => ent(S.selectIdea(ideas(), 'i1', B));
const captioned = () => { const e = selected(); return ent(S.acceptCaption(e, captionResp(TEXT.text), { binding: B, selectionRev: e.selection!.rev }, B, { text: null })); };
const checked = () => { const e = captioned(); return ent(S.acceptCheck(e, checkResp(S.textHash(TEXT.text)), { binding: B, selectionRev: e.selection!.rev, captionHash: S.textHash(TEXT.text) }, B, TEXT)); };
const ctx = { text: null, locked: false, overwriteHuman: false, ready: true };

describe('zincir geçersizliği ve geç yanıt', () => {
  it('KANIT DEĞİŞTİ: fikir, seçim VE eski kontrol/caption yeni durumda geçerli sayılmaz; insan düzenlemesi silinmez', () => {
    let e = ent(S.editSelection(checked(), { note: 'insan notu' }, B));
    e = ent(S.acceptCaption(e, captionResp(TEXT.text), { binding: B, selectionRev: e.selection!.rev }, B, { text: TEXT }));
    e = ent(S.acceptCheck(e, checkResp(S.textHash(TEXT.text)), { binding: B, selectionRev: e.selection!.rev, captionHash: S.textHash(TEXT.text) }, B, TEXT));
    expect(S.checkStatus(e, TEXT, B)).toBe('geçerli');
    const x = S.markEvidenceChanged(e);
    expect(S.ideasStatus(x, B)).toBe('eski_kanıt');
    expect(S.selectionStatus(x, B)).toBe('eski_kanıt');
    expect(S.checkStatus(x, TEXT, B)).toBe('eski_kanıt');
    expect(S.captionStatus(x, TEXT, B)).toBe('eski_kanıt');
    expect(x.selection!.note).toBe('insan notu');
  });
  it('geçersizleşmiş zincir geç caption/kontrol yanıtıyla CANLANMAZ', () => {
    const e = S.markEvidenceChanged(captioned());
    const snap = { binding: B, selectionRev: e.selection!.rev, captionHash: S.textHash(TEXT.text) };
    expect(S.acceptCheck(e, checkResp(snap.captionHash), snap, B, TEXT).ok).toBe(false);
    expect(S.acceptCaption(e, captionResp('x'.repeat(60)), { binding: B, selectionRev: snap.selectionRev }, B, { text: TEXT }).ok).toBe(false);
    expect(S.canRun('caption', e, B, ctx)).toMatchObject({ ok: false, kind: 'eski' });
  });
  it('NİYET değişimi: seçim “eski_niyet”, caption/kontrol ilerlemez, yeni (eski niyetli) fikirden seçim yapılamaz, düzenleme korunur', () => {
    const e = S.setIntent(ent(S.editSelection(selected(), { mainMessage: 'Benim mesajım' }, B)), 'yap', 'başka hedef');
    expect(S.ideasStatus(e, B)).toBe('eski_niyet');
    expect(S.selectionStatus(e, B)).toBe('eski_niyet');
    expect(S.canRun('caption', e, B, ctx).ok).toBe(false);
    expect(S.selectIdea(e, 'i2', B).ok).toBe(false);
    expect(S.editSelection(e, { note: 'x' }, B).ok).toBe(false);
    expect(e.selection!.mainMessage).toBe('Benim mesajım');
    // yeni niyetle yeni fikirler → seçim eski düzenlemeyi park eder, ezmez
    const fresh = ent(S.acceptIdeas(e, ideasResp(), { binding: B, intentRev: e.intent.rev }, B));
    const sel = ent(S.selectIdea(fresh, 'i3', B));
    expect(sel.parked[0].mainMessage).toBe('Benim mesajım');
    expect(S.selectionStatus(sel, B)).toBe('geçerli');
  });
  it('yanıt bağlamı: istek anındaki kırpım/kaynak/varlık/niyet/seçim/metin ile eşleşmeyen YANIT reddedilir (başarı)', () => {
    const e = selected();
    for (const cur of [{ ...B, cropVersion: 2 }, { ...B, sourceVersion: 'x' }, { ...B, assetId: 'a2' }]) {
      expect(S.acceptIdeas(S.emptyEntry('p1'), ideasResp(), { binding: B, intentRev: 0 }, cur).ok).toBe(false);
      expect(S.acceptCaption(e, captionResp('x'.repeat(60)), { binding: B, selectionRev: e.selection!.rev }, cur, { text: null }).ok).toBe(false);
    }
    expect(S.acceptIdeas(S.setIntent(S.emptyEntry('p1'), 'hisset', 'x'), ideasResp(), { binding: B, intentRev: 0 }, B).ok).toBe(false);
    expect(S.acceptCaption(e, captionResp('x'.repeat(60)), { binding: B, selectionRev: e.selection!.rev - 1 }, B, { text: null }).ok).toBe(false);
    const c = captioned();
    expect(S.acceptCheck(c, checkResp(S.textHash(TEXT.text)), { binding: B, selectionRev: c.selection!.rev, captionHash: S.textHash(TEXT.text) }, B, { ...TEXT, text: 'insan yeni yazdı' }).ok).toBe(false);
  });
  it('seçimsiz caption/kontrol çağrılamaz; insan/kilit korunur; deneme sınırı; önbellek sayılmaz', () => {
    const i = ideas();
    expect(S.canRun('caption', i, B, ctx)).toMatchObject({ ok: false, kind: 'secim' });
    expect(S.canRun('check', i, B, { ...ctx, text: TEXT })).toMatchObject({ ok: false, kind: 'secim' });
    const c = captioned();
    expect(S.canRun('caption', c, B, { ...ctx, text: TEXT, locked: true })).toMatchObject({ ok: false, kind: 'kilit' });
    expect(S.canRun('caption', c, B, { ...ctx, text: { ...TEXT, source: 'manual' } })).toMatchObject({ ok: false, kind: 'korunan_metin' });
    expect(S.canRun('caption', c, B, { ...ctx, text: { ...TEXT, source: 'manual' }, overwriteHuman: true }).ok).toBe(true);
    let e = S.emptyEntry('p1');
    for (let k = 0; k < 5; k++) e = ent(S.acceptIdeas(e, ideasResp({ cached: true }), { binding: B, intentRev: 0 }, B));
    expect(S.attemptsUsed(e, 'ideas', B)).toBe(0);
    for (let k = 0; k < 3; k++) e = ent(S.acceptIdeas(e, ideasResp(), { binding: B, intentRev: 0 }, B));
    expect(S.canRun('ideas', e, B, ctx)).toMatchObject({ ok: false, kind: 'sinir' });
    expect(S.canRun('ideas', e, { ...B, cropVersion: 2 }, ctx).ok).toBe(true); // bağlam değişti: sayaç sıfır
  });
  it('kanıt kırpılması yanıtla taşınır (görünür eksiklik)', () => {
    const ev = buildEvidence({ catalog: { subject: 's', description: 'x'.repeat(500), tags: [], visibleObjects: [], foodCategories: [], uncertainties: [] }, visibility: { cropped: false, facts: 'tam' } });
    const e = ent(S.acceptIdeas(S.emptyEntry('p1'), ideasResp({ evidence: ev }), { binding: B, intentRev: 0 }, B));
    expect(e.ideas!.evidence.truncated.length).toBeGreaterThan(0);
  });
});
