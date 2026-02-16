import { auth } from './config';

/**
 * Fetch wrapper that adds Firebase Auth token to requests.
 * Replaces all direct fetch('/api/...') calls in the admin panel.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Not authenticated');

  const token = await user.getIdToken();

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}
