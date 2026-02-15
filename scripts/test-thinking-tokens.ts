/**
 * Test: Does maxOutputTokens include thinking tokens for Gemini 3 Pro?
 * Run with: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/test-thinking-tokens.ts
 */
import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
config({ path: '.env.local' });

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function testTokenBudget(maxOutputTokens: number, label: string) {
  console.log(`\n=== TEST: ${label} (maxOutputTokens=${maxOutputTokens}) ===`);
  const start = Date.now();

  try {
    const result = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: 'Rakle markası hakkında 4-6 cümlelik bir strateji yorumu yaz. Türkçe yaz.',
      config: {
        temperature: 0.9,
        maxOutputTokens,
        // No thinkingConfig → Pro uses default HIGH thinking
      },
    });

    const text = result.text ?? '';
    const candidate = (result as any).candidates?.[0];
    const usage = (result as any).usageMetadata;

    console.log(`Duration: ${Date.now() - start}ms`);
    console.log(`Output text length: ${text.length} chars`);
    console.log(`Output text: "${text.slice(0, 200)}${text.length > 200 ? '...' : ''}"`);
    console.log(`Finish reason: ${candidate?.finishReason}`);
    console.log(`Usage metadata:`, JSON.stringify(usage, null, 2));

    // Check thinking token count
    const thoughtsCount = usage?.thoughtsTokenCount ?? usage?.cachedContentTokenCount ?? 'N/A';
    console.log(`Thoughts token count: ${thoughtsCount}`);
    console.log(`Prompt token count: ${usage?.promptTokenCount}`);
    console.log(`Candidates token count: ${usage?.candidatesTokenCount}`);
    console.log(`Total token count: ${usage?.totalTokenCount}`);

  } catch (err: any) {
    console.log(`Duration: ${Date.now() - start}ms`);
    console.log(`ERROR: ${err.message}`);
  }
}

async function testWithThinkingBudget(maxOutputTokens: number, thinkingBudget: number, label: string) {
  console.log(`\n=== TEST: ${label} (maxOutputTokens=${maxOutputTokens}, thinkingBudget=${thinkingBudget}) ===`);
  const start = Date.now();

  try {
    const result = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: 'Rakle markası hakkında 4-6 cümlelik bir strateji yorumu yaz. Türkçe yaz.',
      config: {
        temperature: 0.9,
        maxOutputTokens,
        thinkingConfig: { thinkingBudget },
      },
    });

    const text = result.text ?? '';
    const candidate = (result as any).candidates?.[0];
    const usage = (result as any).usageMetadata;

    console.log(`Duration: ${Date.now() - start}ms`);
    console.log(`Output text length: ${text.length} chars`);
    console.log(`Output text: "${text.slice(0, 200)}${text.length > 200 ? '...' : ''}"`);
    console.log(`Finish reason: ${candidate?.finishReason}`);
    console.log(`Usage metadata:`, JSON.stringify(usage, null, 2));
    console.log(`Thoughts token count: ${usage?.thoughtsTokenCount}`);
    console.log(`Candidates token count: ${usage?.candidatesTokenCount}`);

  } catch (err: any) {
    console.log(`Duration: ${Date.now() - start}ms`);
    console.log(`ERROR: ${err.message}`);
  }
}

async function main() {
  // Test 1: Low maxOutputTokens, no thinking config (reproduce the issue)
  await testTokenBudget(1024, 'LOW maxOutputTokens, default thinking');

  // Test 2: High maxOutputTokens, no thinking config
  await testTokenBudget(8192, 'HIGH maxOutputTokens, default thinking');

  // Test 3: Low maxOutputTokens + explicit thinking budget
  await testWithThinkingBudget(1024, 256, 'LOW maxOutputTokens + LOW thinking');

  // Test 4: High maxOutputTokens + explicit thinking budget
  await testWithThinkingBudget(8192, 2048, 'HIGH maxOutputTokens + MED thinking');

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
