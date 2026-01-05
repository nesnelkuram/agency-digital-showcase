import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  return res.status(200).json({
    success: true,
    message: 'API is working!',
    method: req.method,
    hasResendKey: !!process.env.RESEND_API_KEY,
    timestamp: new Date().toISOString()
  });
}
