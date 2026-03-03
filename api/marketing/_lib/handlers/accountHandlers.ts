import type { ToolContext } from '../toolHandlers.js';

export async function handleListConnectedAccounts(ctx: ToolContext) {
  const snap = await ctx.db.collection('platform_accounts')
    .where('tenantId', '==', ctx.tenantId)
    .get();

  const accounts = snap.docs
    .filter(d => d.data().status === 'connected')
    .map(d => {
      const data = d.data();
      return {
        id: d.id,
        platform: data.platform,
        accountName: data.accountName,
        accountId: data.accountId,
        adAccountId: data.metadata?.adAccountId || null,
        pageId: data.metadata?.pageId || null,
        status: data.status,
      };
    });

  return { accounts, component: 'AccountSelector' };
}
