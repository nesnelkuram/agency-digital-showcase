// Oro di Milas sunumunu yalıtılmış olarak yayına hazırlar.
// Canlı sürümün kaynak listesini aynen korur, üzerine yalnız public/orodimilas ve scripts/orodimilas
// dosyalarını ve iki rota kuralını ekler. Çalışma ağacındaki ilgisiz değişiklikler hiç yüklenmez.
// Varsayılan: salt okunur plan. --stage: alan adına atanmamış üretim adayı oluşturur.
// --promote <dpl_id>: test edilmiş adayı canlıya alır.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const teamId = 'team_TlNoVmF3VYBPlu1hT3FfgIm6';
const projectId = 'prj_TKZ8Jcc5NPxtnHUSmWk6byXY7ceh';
const authPath = process.env.VERCEL_AUTH_FILE || '/Users/intiba/Library/Application Support/com.vercel.cli/auth.json';
const { token } = JSON.parse(readFileSync(authPath, 'utf8'));
assert.ok(token, 'Vercel CLI oturumu gerekli.');
const query = `?teamId=${teamId}`;
async function api(endpoint, options = {}) {
  const response = await fetch('https://api.vercel.com' + endpoint + query, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`Vercel ${response.status}: ${body.error?.message || 'istek başarısız'}`);
  return body;
}
const out = path.join(root, 'docs/orodimilas');

const promoteIndex = process.argv.indexOf('--promote');
if (promoteIndex > -1) {
  const id = process.argv[promoteIndex + 1];
  assert.match(id || '', /^dpl_/, 'Canlıya alınacak dağıtım kimliği gerekli.');
  const candidate = await api(`/v13/deployments/${id}`);
  assert.equal(candidate.projectId, projectId);
  assert.equal(candidate.readyState, 'READY', 'Aday hazır değil.');
  assert.equal(candidate.meta?.purpose, 'orodimilas-proposal', 'Bu aday bu betikle oluşturulmamış.');
  const before = await api('/v13/deployments/www.intiba.co.uk');
  assert.equal(before.id, candidate.meta.sourceDeployment, 'Aday oluşturulduktan sonra canlı sürüm değişmiş; yeniden hazırlayın.');
  await api(`/v10/projects/${projectId}/promote/${id}`, { method: 'POST' });
  const report = JSON.parse(readFileSync(path.join(out, 'deployment.json'), 'utf8'));
  Object.assign(report, { promoted: true, promotedAt: new Date().toISOString() });
  writeFileSync(path.join(out, 'deployment.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ promoted: id, previousProduction: before.id }, null, 2));
  process.exit(0);
}

const live = await api('/v13/deployments/www.intiba.co.uk');
assert.equal(live.projectId, projectId);
const tree = await api(`/v6/deployments/${live.id}/files`);
function flatten(nodes, prefix = '') {
  return nodes.flatMap(node => node.type === 'directory' ? flatten(node.children || [], prefix + node.name + '/') : [{ ...node, name: prefix + node.name }]);
}
const sourceRoot = tree.find(node => node.name === 'src' && node.type === 'directory');
assert.ok(sourceRoot, 'Canlı sürümün kaynak ağacı alınamadı.');
const manifest = flatten([sourceRoot]).map(file => ({ file: file.name.slice(4), sha: file.uid }));
const fileMap = new Map(manifest.map(file => [file.file, file]));
const isUpdate = [...fileMap.keys()].some(name => name.startsWith('public/orodimilas/'));
async function sourceText(filename) {
  const entry = fileMap.get(filename);
  assert.ok(entry, `Canlı kaynakta ${filename} yok`);
  const body = await api(`/v8/deployments/${live.id}/files/${entry.sha}`);
  return Buffer.from(body.data, 'base64').toString('utf8');
}

const config = JSON.parse(await sourceText('vercel.json'));
const overlay = new Map();
// İlk yayında iki rota eklenir; güncellemede canlıdaki vercel.json olduğu gibi kalır.
if (!config.rewrites.some(rule => rule.source.startsWith('/orodimilas'))) {
  config.rewrites.unshift(
    { source: '/orodimilas', destination: '/orodimilas/index.html' },
    { source: '/orodimilas/', destination: '/orodimilas/index.html' },
  );
  overlay.set('vercel.json', Buffer.from(JSON.stringify(config, null, 2) + '\n'));
}
function collect(directory) {
  for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = directory + '/' + entry.name;
    if (entry.isDirectory()) collect(relative);
    else if (entry.isFile() && entry.name !== '.DS_Store') overlay.set(relative, readFileSync(path.join(root, relative)));
  }
}
collect('public/orodimilas');
collect('scripts/orodimilas');
overlay.set('scripts/build-orodimilas-showcase.mjs', readFileSync(path.join(root, 'scripts/build-orodimilas-showcase.mjs')));
// Görüşme soruları API'si: yalnız bu üç dosya; diğer api/_lib dosyaları canlıdaki haliyle kalır.
collect('api/orodimilas');
for (const name of ['orodimilasQuestionnaire.ts', 'orodimilasQuestions.json']) overlay.set('api/_lib/' + name, readFileSync(path.join(root, 'api/_lib', name)));
for (const name of [...overlay.keys()]) if (name.endsWith('.mjs') && name.startsWith('api/')) overlay.delete(name);

const report = {
  priorProductionDeployment: live.id,
  mode: isUpdate ? 'update' : 'first-release',
  publicUrl: 'https://www.intiba.co.uk/orodimilas/',
  sourceFileCount: manifest.length,
  changedFiles: [...overlay.keys()],
  retainedUnchangedFiles: manifest.filter(file => !overlay.has(file.file)).length,
  promoted: false,
  createdAt: new Date().toISOString(),
};
console.log(JSON.stringify(report, null, 2));
if (!process.argv.includes('--stage')) {
  console.log('Salt okunur plan tamam. Adayı oluşturmak için --stage verin.');
  process.exit(0);
}

for (const [filename, contents] of overlay) {
  const sha = createHash('sha1').update(contents).digest('hex');
  const result = await fetch('https://api.vercel.com/v2/files' + query, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Content-Length': String(contents.length), 'x-vercel-digest': sha }, body: contents });
  if (!result.ok) throw new Error(`${filename} yüklenemedi: ${result.status}`);
  fileMap.set(filename, { file: filename, sha, size: contents.length });
}
const deployment = await api('/v13/deployments', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...config,
    name: 'v0-intiba-website', project: projectId, target: 'production',
    autoAssignCustomDomains: false,
    files: [...fileMap.values()],
    projectSettings: {
      framework: live.projectSettings.framework,
      buildCommand: live.projectSettings.buildCommand,
      installCommand: live.projectSettings.installCommand,
      nodeVersion: live.projectSettings.nodeVersion,
      outputDirectory: live.projectSettings.outputDirectory,
    },
    meta: { purpose: 'orodimilas-proposal', sourceDeployment: live.id, isolatedOverlay: 'true' },
  }),
});
Object.assign(report, { newProductionDeployment: deployment.id, stagingUrl: 'https://' + deployment.url, buildStatus: deployment.readyState });
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'deployment.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ id: deployment.id, url: report.stagingUrl, status: deployment.readyState, promoted: false }, null, 2));
