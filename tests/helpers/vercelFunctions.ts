/** vercel.json `functions` desenlerini Vercel'in yaptığı gibi çözer: ilk eşleşen kazanır; `{a,b}` (iç içe) ve `*` desteklenir. */
export function expandBraces(p: string): string[] {
  const m = /\{([^{}]*)\}/.exec(p);
  if (!m) return [p];
  return m[1].split(',').flatMap((alt) => expandBraces(p.slice(0, m.index) + alt + p.slice(m.index + m[0].length)));
}
const globToRe = (g: string) => new RegExp(`^${g.replace(/[.+?^$()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
export function resolveFunctionConfig(functions: Record<string, any>, file: string): any | undefined {
  for (const [pattern, cfg] of Object.entries(functions)) {
    if (expandBraces(pattern).some((g) => g === file || globToRe(g).test(file))) return cfg;
  }
  return undefined;
}
