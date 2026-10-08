// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
const mocks = vi.hoisted(() => ({ verifyIdToken: vi.fn(), userGet: vi.fn(), getDb: vi.fn() }));
vi.mock('../api/_lib/firebaseAdmin.js', () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mocks.verifyIdToken }),
  getAdminDb: () => mocks.getDb(),
}));
import { odagiApplicationSchema } from '../api/_lib/odagiApplications.js';
import handler, { requireOdagiAdmin } from '../api/odagi/applications.js';

export const fixture = () => ({
  requestId: randomUUID(), name: 'Örnek Başvuru', email: 'example@example.invalid',
  city: 'İstanbul', district: 'Kadıköy', neighborhood: 'Caferağa', area: 12.5,
  occupation: 'Tasarımcı', employed: 'yes', ownsSpace: 'yes', company: 'considering',
  daytimeAvailable: 'yes', couriers: 'Yakındaki şubeye teslim edebilirim.',
  petSmoke: ['clear'], roomConditions: ['clear'], packingSpace: 'yes', investment: 'no',
  roomInfo: 'Kuru, aydınlık ve ayrı bir oda.', income: '5-25', applicationConsent: true, website: '',
});
const request = (method = 'POST', extra = {}) => ({ method, query: {}, headers: { origin: 'https://www.intiba.co.uk', 'content-type': 'application/json' }, socket: { remoteAddress: 'odagi-unit-test' }, body: fixture(), ...extra }) as any;
const response = () => ({
  code: 200, body: undefined as any, headers: {} as Record<string,string>,
  setHeader(key: string, value: string) { this.headers[key] = value; },
  status(code: number) { this.code = code; return this; },
  json(body: unknown) { this.body = body; return this; },
}) as any;

describe('Odağı application validation and access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyIdToken.mockResolvedValue({ uid: 'odagi-test-admin' });
    mocks.getDb.mockReturnValue({ collection: () => ({ doc: () => ({ get: mocks.userGet }) }) });
  });
  it('normalizes Turkish text and email while retaining half-square-metre precision', () => {
    const parsed = odagiApplicationSchema.parse({ ...fixture(), name: '  İpek Yılmaz  ', email: ' Example@Example.invalid ' });
    expect(parsed.name).toBe('İpek Yılmaz'); expect(parsed.email).toBe('example@example.invalid'); expect(parsed.area).toBe(12.5);
  });
  it.each([
    { email: 'not-an-email' }, { name: '  ' }, { area: 0 }, { area: 10001 }, { area: 12.3 },
    { area: '12' }, { applicationConsent: false }, { applicationConsent: undefined },
    { petSmoke: [] }, { petSmoke: ['clear','pets'] }, { roomConditions: ['clear','damp'] },
    { petSmoke: ['pets','pets'] }, { company: 'maybe' }, { requestId: 'guessable' },
    { roomInfo: 'short\u0000value' }, { tenantId: 'someone-else' },
  ])('rejects invalid or contradictory application data: %j', change => {
    expect(odagiApplicationSchema.safeParse({ ...fixture(), ...change }).success).toBe(false);
  });
  it('does not expose applications to unauthenticated visitors', async () => {
    const res = response(); await handler(request('GET', { headers: {} }), res);
    expect(res.code).toBe(401); expect(mocks.getDb).not.toHaveBeenCalled();
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });
  it.each([
    { role: 'client', status: 'active', tenantId: 'intiba' },
    { role: 'editor', status: 'active', tenantId: 'intiba' },
    { role: 'admin', status: 'suspended', tenantId: 'intiba' },
    { role: 'admin', status: 'active', tenantId: 'other' }, undefined,
  ])('rejects unauthorized accounts: %j', async user => {
    mocks.userGet.mockResolvedValue({ data: () => user });
    await expect(requireOdagiAdmin(request('GET', { headers: { authorization: 'Bearer token' } }))).rejects.toMatchObject({ status: 403 });
  });
  it('allows the active owner administrator and checks token revocation', async () => {
    mocks.userGet.mockResolvedValue({ data: () => ({ role: 'admin', status: 'active', tenantId: 'intiba' }) });
    await requireOdagiAdmin(request('GET', { headers: { authorization: 'Bearer token' } }));
    expect(mocks.verifyIdToken).toHaveBeenCalledWith('token', true);
  });
  it('rejects revoked tokens before reading application data', async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error('revoked'));
    await expect(requireOdagiAdmin(request('GET', { headers: { authorization: 'Bearer revoked' } }))).rejects.toMatchObject({ status: 401 });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it.each(['https://unrelated.example', undefined])('rejects writes without a trusted Origin: %s', async origin => {
    const res = response(); await handler(request('POST', { headers: { origin, 'content-type': 'application/json' } }), res);
    expect(res.code).toBe(403); expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it('rejects malformed form data before initializing storage', async () => {
    const res = response(); await handler(request('POST', { body: { name: 'Only a name' } }), res);
    expect(res.code).toBe(400); expect(res.body.fields).toContain('email'); expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it('rejects oversized payloads and non-JSON submissions', async () => {
    const large = response(); await handler(request('POST', { body: { name: 'x'.repeat(25000) } }), large); expect(large.code).toBe(413);
    const form = response(); await handler(request('POST', { headers: { origin:'https://www.intiba.co.uk','content-type':'text/plain' } }), form); expect(form.code).toBe(415);
  });
  it('returns a failure when persistence fails, never a success receipt', async () => {
    const consoleSpy = vi.spyOn(console,'error').mockImplementation(() => {});
    mocks.getDb.mockImplementation(() => { throw new Error('storage unavailable'); });
    const res = response(); await handler(request(), res);
    expect(res.code).toBe(503); expect(res.body.reference).toBeUndefined();
    consoleSpy.mockRestore();
  });
});
