import type { VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { withAuth, AuthenticatedRequest } from './_lib/withAuth';

export const config = {
  maxDuration: 120,
};

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  try {
    const { audioData, audioMimeType, videoUrl, mimeType, duration, recordingMode } = req.body;
    const client = new GoogleGenAI({ apiKey });
    const prompt = buildPrompt(duration, recordingMode);

    let result;

    if (audioData) {
      // FAST PATH: Inline audio data - no File API, no download, near-instant
      result = await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: audioData, mimeType: audioMimeType || 'audio/webm' } },
              { text: prompt },
            ],
          },
        ],
        config: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
    } else if (videoUrl) {
      // SLOW PATH (fallback for file uploads): Download + Gemini File API
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.statusText}`);
      }
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      const resolvedMime = mimeType || 'video/webm';

      const uploadedFile = await client.files.upload({
        file: new Blob([videoBuffer], { type: resolvedMime }),
        config: { mimeType: resolvedMime },
      });

      let file = uploadedFile;
      while (file.state === 'PROCESSING') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        file = await client.files.get({ name: file.name! });
      }
      if (file.state === 'FAILED') {
        throw new Error('Gemini file processing failed');
      }

      result = await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: file.uri!, mimeType: file.mimeType! } },
              { text: prompt },
            ],
          },
        ],
        config: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      // Cleanup uploaded file
      try {
        await client.files.delete({ name: file.name! });
      } catch {
        // Non-critical
      }
    } else {
      return res.status(400).json({ error: 'Missing audioData or videoUrl' });
    }

    const responseText = result.text ?? '';
    if (!responseText) {
      throw new Error('Gemini returned empty response');
    }

    const parsed = JSON.parse(responseText);

    return res.status(200).json({
      success: true,
      title: parsed.title || 'Isimsiz Video',
      description: parsed.description || '',
    });
  } catch (error: any) {
    console.error('Video transcription error:', error);
    return res.status(500).json({
      error: error.message || 'Transcription failed',
    });
  }
});

function buildPrompt(duration?: number, recordingMode?: string): string {
  const modeHint =
    recordingMode === 'screen'
      ? 'Bu bir ekran kaydidir.'
      : recordingMode === 'camera'
        ? 'Bu bir kamera kaydidir.'
        : recordingMode === 'screen_camera'
          ? 'Bu bir ekran ve kamera kaydidir.'
          : '';

  return `Bu bir geribildirim/inceleme kaydidir. ${modeHint}
${duration ? `Kayit suresi: ${Math.round(duration)} saniye.` : ''}

Bu ses kaydini analiz et ve asagidaki JSON formatinda cevap ver:

{
  "title": "Kisa ve aciklayici bir baslik (maksimum 60 karakter, Turkce)",
  "description": "Kaydin icerigini ozetleyen 1-3 cumle (Turkce)"
}

ONEMLI:
- Sadece JSON don, baska bir sey yazma
- Eger konusma varsa, konusmaya dayali baslik ve aciklama olustur
- Eger konusma yoksa veya anlasilamiyorsa, genel bir baslik ver (ornegin "Ekran Kaydi - Geribildirim")
- Baslik kisa ve anlasilir olmali
- Tum icerik Turkce olmali`;
}
