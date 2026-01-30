import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  const diagnostics: Record<string, string> = {};

  // Test 1: Can we import @google/genai?
  try {
    const { GoogleGenAI } = await import('@google/genai');
    diagnostics.sdk = 'ok';
    diagnostics.sdkType = typeof GoogleGenAI;
  } catch (e: any) {
    diagnostics.sdk = `FAIL: ${e.message}`;
  }

  // Test 2: Can we import pipeline?
  try {
    const { runPipeline } = await import('../src/pipeline/pipeline');
    diagnostics.pipeline = 'ok';
    diagnostics.pipelineType = typeof runPipeline;
  } catch (e: any) {
    diagnostics.pipeline = `FAIL: ${e.message}`;
  }

  // Test 3: Can we import geminiClient?
  try {
    const { generateJSON } = await import('../src/pipeline/geminiClient');
    diagnostics.geminiClient = 'ok';
    diagnostics.generateJSONType = typeof generateJSON;
  } catch (e: any) {
    diagnostics.geminiClient = `FAIL: ${e.message}`;
  }

  // Test 4: Environment
  diagnostics.hasApiKey = process.env.GEMINI_API_KEY ? 'yes' : 'no';
  diagnostics.nodeVersion = process.version;

  return res.status(200).json({ diagnostics });
}
