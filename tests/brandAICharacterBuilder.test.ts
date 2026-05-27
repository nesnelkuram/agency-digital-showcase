import { describe, it, expect } from 'vitest';
import { buildBrandCharacterPure } from '@/shared/services/brandAICharacterBuilder';

describe('buildBrandCharacterPure', () => {
  it('returns hasAnalysis=false for lead with no aiAnalysis', () => {
    const lead = {
      contact: { companyName: 'Acme' },
      sector: 'Teknoloji',
    };
    const c = buildBrandCharacterPure(lead, 'lead-1', 'proj-1');
    expect(c.hasAnalysis).toBe(false);
    expect(c.brandId).toBe('lead-1');
    expect(c.brandName).toBe('Acme');
    expect(c.projectId).toBe('proj-1');
  });

  it('derives brandName from contact.companyName first', () => {
    const lead = {
      contact: { companyName: 'Racle', fullName: 'Mehmet' },
    };
    const c = buildBrandCharacterPure(lead, 'lead-1');
    expect(c.brandName).toBe('Racle');
  });

  it('falls back to contact.fullName when companyName missing', () => {
    const lead = {
      contact: { fullName: 'Mehmet Özdemir' },
    };
    const c = buildBrandCharacterPure(lead, 'lead-1');
    expect(c.brandName).toBe('Mehmet Özdemir');
  });

  it('falls back to "Marka" when contact fields all empty', () => {
    const c = buildBrandCharacterPure({}, 'lead-1');
    expect(c.brandName).toBe('Marka');
  });

  it('generates voiceSummary from archetype + tone + traits', () => {
    const lead = {
      contact: { companyName: 'Racle' },
      aiAnalysis: {
        brandPersonality: {
          archetype: 'Kaşif',
          tone: 'samimi',
          voice: 'enerjik',
          traits: ['cesur', 'meraklı', 'özgün'],
        },
      },
    };
    const c = buildBrandCharacterPure(lead, 'lead-1');
    expect(c.voiceSummary).toContain('Kaşif');
    expect(c.voiceSummary).toContain('samimi ton');
    // Sadece ilk 2 trait kullanılır
    expect(c.voiceSummary).toContain('cesur & meraklı');
  });

  it('returns fallback voiceSummary when nothing available', () => {
    const c = buildBrandCharacterPure({ contact: { companyName: 'X' } }, 'lead-1');
    expect(c.voiceSummary).toBe('Marka karakteri henüz oluşturulmamış');
  });

  it('injects brandName into systemPrompt', () => {
    const lead = { contact: { companyName: 'Racle' } };
    const c = buildBrandCharacterPure(lead, 'lead-1');
    expect(c.systemPrompt).toContain('"Racle" markasının sesisin');
  });

  it('includes brandPersonality sections in systemPrompt', () => {
    const lead = {
      contact: { companyName: 'Racle' },
      aiAnalysis: {
        brandPersonality: {
          archetype: 'Kaşif',
          tone: 'samimi',
          voice: 'enerjik',
          traits: ['cesur', 'meraklı'],
        },
      },
    };
    const c = buildBrandCharacterPure(lead, 'lead-1');
    expect(c.systemPrompt).toContain('## MARKA KARAKTERİ');
    expect(c.systemPrompt).toContain('Arketip: Kaşif');
    expect(c.systemPrompt).toContain('Ton: samimi');
    expect(c.systemPrompt).toContain('Ses: enerjik');
    expect(c.systemPrompt).toContain('cesur, meraklı');
  });

  it('includes character sliders in systemPrompt', () => {
    const lead = {
      contact: { companyName: 'Racle' },
      aiAnalysis: {
        brandCharacter: {
          sliders: { friendAuthority: 7, youngMature: 5, playfulSerious: 3, massElite: 8 },
        },
      },
    };
    const c = buildBrandCharacterPure(lead, 'lead-1');
    expect(c.systemPrompt).toContain('KARAKTER TERAZİLERİ');
    expect(c.systemPrompt).toContain('Arkadaş ↔ Otorite: 7/10');
    expect(c.systemPrompt).toContain('Kitle ↔ Elit: 8/10');
  });

  it('includes weAreThis / weAreNotThis', () => {
    const lead = {
      contact: { companyName: 'Racle' },
      aiAnalysis: {
        brandCharacter: {
          weAreThis: ['şeffaf', 'hızlı'],
          weAreNotThis: ['ukala', 'yavaş'],
        },
      },
    };
    const c = buildBrandCharacterPure(lead, 'lead-1');
    expect(c.systemPrompt).toContain('BİZ ŞUYUZ');
    expect(c.systemPrompt).toContain('şeffaf');
    expect(c.systemPrompt).toContain('BİZ ŞU(N)LAR DEĞİLİZ');
    expect(c.systemPrompt).toContain('ukala');
  });

  it('includes emotionalNarrative', () => {
    const lead = {
      contact: { companyName: 'Racle' },
      aiAnalysis: {
        emotionalNarrative: {
          manifesto: 'Yeniliği sıradanlaştırıyoruz.',
          oneLinePromise: 'Her gün daha iyi.',
        },
      },
    };
    const c = buildBrandCharacterPure(lead, 'lead-1');
    expect(c.systemPrompt).toContain('MANİFESTO');
    expect(c.systemPrompt).toContain('Yeniliği sıradanlaştırıyoruz.');
    expect(c.systemPrompt).toContain('SÖZ');
    expect(c.systemPrompt).toContain('Her gün daha iyi.');
  });

  it('always ends with writing rules', () => {
    const c = buildBrandCharacterPure({ contact: { companyName: 'X' } }, 'lead-1');
    expect(c.systemPrompt).toContain('## YAZIM KURALLARI');
    expect(c.systemPrompt).toContain('Türkçe yaz');
    expect(c.systemPrompt).toContain('BİZ ŞU(N)LAR DEĞİLİZ');
  });

  it('hasAnalysis=true when aiAnalysis exists', () => {
    const lead = {
      contact: { companyName: 'X' },
      aiAnalysis: { brandPersonality: { archetype: 'X', tone: '', voice: '', traits: [] } },
    };
    const c = buildBrandCharacterPure(lead, 'lead-1');
    expect(c.hasAnalysis).toBe(true);
  });

  it('extracts sector and targetAudience from positioning', () => {
    const lead = {
      sector: 'Gastronomi',
      contact: { companyName: 'Fıra' },
      aiAnalysis: {
        positioning: { targetAudience: 'Genç profesyoneller' },
      },
    };
    const c = buildBrandCharacterPure(lead, 'lead-1');
    expect(c.sourceFields.sector).toBe('Gastronomi');
    expect(c.sourceFields.targetAudience).toBe('Genç profesyoneller');
    expect(c.systemPrompt).toContain('SEKTÖR');
    expect(c.systemPrompt).toContain('Gastronomi');
    expect(c.systemPrompt).toContain('HEDEF KİTLE');
  });

  it('returns different prompts for different brand characters', () => {
    const eglenceli = buildBrandCharacterPure(
      {
        contact: { companyName: 'Eğlenceli' },
        aiAnalysis: { brandPersonality: { archetype: 'Joker', tone: 'şakacı' } },
      },
      'l1'
    );
    const ciddi = buildBrandCharacterPure(
      {
        contact: { companyName: 'Ciddi' },
        aiAnalysis: { brandPersonality: { archetype: 'Bilge', tone: 'resmi' } },
      },
      'l2'
    );
    expect(eglenceli.systemPrompt).not.toBe(ciddi.systemPrompt);
    expect(eglenceli.systemPrompt).toContain('Joker');
    expect(ciddi.systemPrompt).toContain('Bilge');
  });
});
