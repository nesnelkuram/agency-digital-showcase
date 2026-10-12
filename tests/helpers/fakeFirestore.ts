/** Transaction ve basit sorgu destekli minimal sahte Firestore (JS tek iş parçacığı: transaction gövdesi atomik) */
type Filter = { field: string; op: '==' | 'in' | '>=' | '<=' | '<' | '>'; value: any };

export function fakeFirestore() {
  const data = new Map<string, any>();
  let chain: Promise<unknown> = Promise.resolve();
  const ref = (path: string) => ({
    path,
    id: path.split('/').pop()!,
    get: async () => ({ exists: data.has(path), id: path.split('/').pop()!, data: () => data.get(path) }),
    set: async (v: any, opts?: { merge?: boolean }) => void data.set(path, opts?.merge ? { ...(data.get(path) || {}), ...v } : { ...v }),
    update: async (p: any) => void data.set(path, { ...data.get(path), ...p }),
    delete: async () => void data.delete(path),
  });
  type Order = { field: string; dir: 'asc' | 'desc' };
  const val = (r: { id: string; v: any }, f: string) => (f === '__name__' ? r.id : r.v?.[f]);
  const cmp = (a: any, b: any) => (a === b ? 0 : (a ?? -Infinity) < (b ?? -Infinity) ? -1 : 1);
  const query = (col: string, filters: Filter[] = [], orders: Order[] = [], lim?: number, after?: any[]): any => ({
    where: (field: string, op: Filter['op'], value: any) => query(col, [...filters, { field, op, value }], orders, lim, after),
    orderBy: (field: string, dir: 'asc' | 'desc' = 'asc') => query(col, filters, [...orders, { field, dir }], lim, after),
    limit: (n: number) => query(col, filters, orders, n, after),
    startAfter: (...values: any[]) => query(col, filters, orders, lim, values),
    get: async () => {
      let rows = [...data.entries()]
        .filter(([p]) => p.startsWith(`${col}/`) && p.split('/').length === 2)
        .map(([p, v]) => ({ id: p.split('/')[1], ref: ref(p), data: () => v, v }))
        .filter((r) =>
          filters.every((f) => {
            const x = val(r, f.field);
            if (f.op === '==') return x === f.value;
            if (f.op === 'in') return f.value.includes(x);
            if (x === undefined || x === null) return false; // Firestore: aralık filtresi alanı olmayanı dışlar
            return f.op === '>=' ? x >= f.value : f.op === '<=' ? x <= f.value : f.op === '<' ? x < f.value : x > f.value;
          })
        );
      const byOrder = (a: any, b: any) => {
        for (const o of orders) {
          const c = cmp(val(a, o.field), val(b, o.field)) * (o.dir === 'desc' ? -1 : 1);
          if (c) return c;
        }
        return 0;
      };
      rows.sort(byOrder);
      if (after) {
        rows = rows.filter((r) => {
          for (let i = 0; i < after.length; i++) {
            const o = orders[i];
            const c = cmp(val(r, o.field), after[i]) * (o.dir === 'desc' ? -1 : 1);
            if (c) return c > 0;
          }
          return false;
        });
      }
      if (lim !== undefined) rows = rows.slice(0, lim);
      return { docs: rows, size: rows.length, empty: rows.length === 0 };
    },
  });
  return {
    data,
    collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`), ...query(c) }),
    // Transaction'lar SIRAYLA çalışır (gerçek Firestore'un çakışmada yeniden deneyerek sağladığı serileştirmeyi taklit eder):
    // gövde await içerse bile iki eşzamanlı transaction iç içe geçmez.
    runTransaction: (fn: any) => {
      const run = chain.then(() =>
        fn({
          get: (r: any) => r.get(),
          update: (r: any, p: any) => data.set(r.path, { ...data.get(r.path), ...p }),
          set: (r: any, v: any, opts?: { merge?: boolean }) => data.set(r.path, opts?.merge ? { ...(data.get(r.path) || {}), ...v } : { ...v }),
          delete: (r: any) => void data.delete(r.path),
        })
      );
      chain = run.then(() => undefined, () => undefined);
      return run;
    },
  };
}
