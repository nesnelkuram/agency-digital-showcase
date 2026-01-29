import 'dotenv/config';
import { runPipeline } from '../server/lib/pipeline';

async function test() {
  try {
    console.log('GEMINI_API_KEY set:', !!process.env.GEMINI_API_KEY);
    console.log('GOOGLE_SEARCH_API_KEY set:', !!process.env.GOOGLE_SEARCH_API_KEY);
    console.log('Starting lite pipeline test...');
    const start = Date.now();

    const result = await runPipeline({
      contact: { name: 'Test', businessName: 'Dost Findik', email: 'test@test.com' },
      sector: 'fmcg',
      wizard: {
        answers: {
          '3': 'certified', '4': 'planned', '5': 'yes',
          '9': 'trust', '10': 'quality_story', '11': 'traditional',
          '15': 'explain', '16': 'consistency', '17': 'warm',
          '21': 'price_only', '22': 'perception', '23': 'positioning',
          '27': 'awareness', '28': 'balanced', '29': 'repeat_purchase',
        },
        scores: {
          '3': 100, '4': 100, '5': 100,
          '9': 80, '10': 80, '11': 60,
          '15': 80, '16': 80, '17': 60,
          '21': 80, '22': 60, '23': 80,
          '27': 80, '28': 80, '29': 80,
        },
        stageResults: [],
      },
      requestedServices: [{ id: '1', title: 'Sosyal Medya Yonetimi' }],
      leadId: 'test-123',
      mode: 'lite',
    });

    console.log('\nSUCCESS in ' + ((Date.now() - start) / 1000).toFixed(1) + 's');
    console.log('Timings:', JSON.stringify(result.timings));
    console.log('Errors:', result.errors.length ? JSON.stringify(result.errors, null, 2) : 'None');
    console.log('\n--- Results ---');
    console.log('Archetype:', result.synthesizedAnalysis?.brandPersonality?.archetype);
    console.log('Positioning:', result.synthesizedAnalysis?.positioning?.statement);
    console.log('Colors:', result.synthesizedAnalysis?.visualWorld?.colorPalette?.length);
    console.log('Pillars:', result.synthesizedAnalysis?.contentStrategy?.pillars?.length);
  } catch (err: any) {
    console.error('FAILED:', err.message);
    console.error(err.stack?.split('\n').slice(0, 5).join('\n'));
  }
}

test();
