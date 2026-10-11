export const PLAN_COLLECTION: string;
export const POST_COLLECTION: string;
export const DRAFT_STORAGE_ROOT: string;
export function sha256Hex(input: string | Uint8Array): string;
export function parseWeek(range: string): { weekStart: string; weekEnd: string };
export function planKeyOf(weekStart: string): string;
export function planDocId(a: { tenantId: string; projectId: string; planKey: string }): string;
export function postDocId(a: { tenantId: string; projectId: string; planKey: string; dayOrder: number; frame: number; assetId: string }): string;
export function contentHashOf(obj: Record<string, any>): string;
export function buildNativeRecords(a: { plan: any; manifest: any; tenantId: string; projectId: string; createdBy?: string; thumbnails?: Record<string, string> }): {
  planId: string; planKey: string; planDoc: Record<string, any>; posts: Record<string, any>[]; storage: { assetId: string; origName: string; origSha256: string; origPath: string; prevPath: string }[];
};
export function validateNative(a: { plan: any; manifest: any; planDoc: any; posts: any[] }): { ok: boolean; problems: string[]; info: Record<string, number> };
export function verifyFiles(a: { manifest: any; readFile: (name: string) => Uint8Array | null; hashFn?: (b: Uint8Array) => string }): { ok: boolean; mismatches: { asset_id: string; reason: string }[] };
