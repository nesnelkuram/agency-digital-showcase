import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { chat } from '../_lib/persona-bundle.mjs';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, message } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, message' });
    }

    // Load conversation history from Firestore
    let history: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }> = [];
    try {
      const db = getAdminDb();
      const sessionDoc = await db.collection('persona_sessions').doc(sessionId).get();
      if (sessionDoc.exists) {
        history = sessionDoc.data()?.messages || [];
      }
    } catch (err) {
      console.warn('persona/chat: Could not load session history:', err);
    }

    // Load user preferences from negative feedback corrections
    let preferences: string[] = [];
    try {
      const db = getAdminDb();
      const feedbackSnap = await db
        .collection('persona_feedback')
        .where('sessionId', '==', sessionId)
        .where('feedback', '==', 'negative')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

      preferences = feedbackSnap.docs
        .map(doc => doc.data().correction)
        .filter((c): c is string => !!c && c.trim().length > 0);
    } catch (err) {
      // Preferences are best-effort — don't block chat
      console.warn('persona/chat: Could not load feedback preferences:', err);
    }

    // Run persona chat
    const result = await chat(message, history, preferences.length > 0 ? preferences : undefined);

    // Save messages to Firestore
    const userMsg = { role: 'user' as const, content: message, timestamp: Date.now() };
    const assistantMsg = {
      role: 'assistant' as const,
      content: result.reply,
      timestamp: Date.now(),
      articlesReferenced: result.articlesReferenced.slice(0, 5),
    };

    try {
      const db = getAdminDb();
      const articleIds = result.articlesReferenced.map((a: any) => a.id);
      await db.collection('persona_sessions').doc(sessionId).update({
        messages: FieldValue.arrayUnion(userMsg, assistantMsg),
        articleRefsUsed: FieldValue.arrayUnion(...articleIds),
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn('persona/chat: Could not save messages to Firestore:', err);
    }

    return res.status(200).json({
      reply: result.reply,
      articlesReferenced: result.articlesReferenced,
    });
  } catch (error: any) {
    console.error('persona/chat error:', error);
    return res.status(500).json({
      error: String(error?.message || 'Chat failed'),
    });
  }
}
