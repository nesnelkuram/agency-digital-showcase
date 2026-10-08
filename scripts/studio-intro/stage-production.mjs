// Studio tanıtım sayfasını (/studio) yalıtılmış olarak yayına hazırlar.
// Canlı sürümün kaynak listesini aynen korur, üzerine yalnız tanıtım sayfası dosyalarını ekler.
// Çalışma ağacındaki ilgisiz değişiklikler hiç yüklenmez. Canlı vercel.json olduğu gibi kalır.
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
const purpose = 'studio-intro';
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
const out = path.join(root, 'docs/studio-intro');
const sha1 = (buffer) => createHash('sha1').update(buffer).digest('hex');

const promoteIndex = process.argv.indexOf('--promote');
if (promoteIndex > -1) {
  const id = process.argv[promoteIndex + 1];
  assert.match(id || '', /^dpl_/, 'Canlıya alınacak dağıtım kimliği gerekli.');
  const candidate = await api(`/v13/deployments/${id}`);
  assert.equal(candidate.projectId, projectId);
  assert.equal(candidate.readyState, 'READY', 'Aday hazır değil.');
  assert.equal(candidate.meta?.purpose, purpose, 'Bu aday bu betikle oluşturulmamış.');
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
async function sourceText(filename) {
  const entry = fileMap.get(filename);
  assert.ok(entry, `Canlı kaynakta ${filename} yok`);
  const body = await api(`/v8/deployments/${live.id}/files/${entry.sha}`);
  return Buffer.from(body.data, 'base64').toString('utf8');
}

const config = JSON.parse(await sourceText('vercel.json'));
const overlay = new Map();

// Canlıdan farklı olabilecek iki dosya: yalnız tanıtım sayfası değişikliklerini taşıdıkları doğrulanır.
const localApp = readFileSync(path.join(root, 'App.tsx'), 'utf8');
const liveApp = await sourceText('App.tsx');
const appWithoutIntro = localApp
  .replace("const StudioLandingPage = lazy(() => import('./studio/landing/StudioLandingPage'));\n", '')
  .replace(/        \{\/\* Studio tanıtım sayfası - Public \*\/\}\n[\s\S]*?        \/>\n\n/, '');
assert.equal(appWithoutIntro, liveApp, 'App.tsx canlıdan tanıtım sayfası dışında da farklı; yalıtılmış yayın yapılamaz.');
overlay.set('App.tsx', Buffer.from(localApp));

const liveStudioApp = await sourceText('studio/StudioApp.tsx');
assert.ok(liveStudioApp.includes('<AuthGuard>') || liveStudioApp.includes('StudioAuthGate'), 'Canlı StudioApp beklenen yapıda değil.');
overlay.set('studio/StudioApp.tsx', readFileSync(path.join(root, 'studio/StudioApp.tsx')));

for (const entry of readdirSync(path.join(root, 'studio/landing'), { withFileTypes: true })) {
  if (entry.isFile() && entry.name !== '.DS_Store') {
    const relative = 'studio/landing/' + entry.name;
    overlay.set(relative, readFileSync(path.join(root, relative)));
  }
}

// three / @react-three/* canlı package.json'da olmalı (yeni bağımlılık eklenmiyor)
const pkg = JSON.parse(await sourceText('package.json'));
for (const dep of ['three', '@react-three/fiber', '@react-three/drei']) assert.ok(pkg.dependencies?.[dep], `${dep} canlıda yok`);

const changed = [...overlay.entries()].filter(([name, buf]) => fileMap.get(name)?.sha !== sha1(buf)).map(([name]) => name);
const report = {
  priorProductionDeployment: live.id,
  publicUrl: 'https://www.intiba.co.uk/studio',
  sourceFileCount: manifest.length,
  changedFiles: changed,
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
  const sha = sha1(contents);
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
    meta: { purpose, sourceDeployment: live.id, isolatedOverlay: 'true' },
  }),
});
Object.assign(report, { newProductionDeployment: deployment.id, stagingUrl: 'https://' + deployment.url, buildStatus: deployment.readyState });
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'deployment.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ id: deployment.id, url: report.stagingUrl, status: deployment.readyState, promoted: false }, null, 2));
