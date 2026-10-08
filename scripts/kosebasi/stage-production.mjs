// Preserve the exact live source manifest and overlay only this showcase.
// Production-target build WITHOUT promotion, equivalent to --prod --skip-domain.
// Uses existing source SHA references; never uploads the dirty workspace.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const teamId = 'team_TlNoVmF3VYBPlu1hT3FfgIm6';
const projectId = 'prj_TKZ8Jcc5NPxtnHUSmWk6byXY7ceh';
const expectedBase = 'dpl_FPK9fbhYs6uPQphGpUxYJGJtoMvv';
const authPath = process.env.VERCEL_AUTH_FILE || '/Users/intiba/Library/Application Support/com.vercel.cli/auth.json';
const { token } = JSON.parse(readFileSync(authPath, 'utf8'));
assert.ok(token, 'Existing Vercel CLI authentication required.');
const query = `?teamId=${teamId}`;
async function api(endpoint, options = {}) {
  const response = await fetch('https://api.vercel.com' + endpoint + query, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(`Vercel ${response.status}: ${body.error?.message || 'request failed'}`);
  return body;
}
const live = await api('/v13/deployments/www.intiba.co.uk');
assert.equal(live.id, expectedBase, 'Production changed; re-review the new live manifest before staging.');
assert.equal(live.projectId, projectId);
const tree = await api(`/v6/deployments/${live.id}/files`);
function flatten(nodes, prefix = '') {
  return nodes.flatMap(node => node.type === 'directory' ? flatten(node.children || [], prefix + node.name + '/') : [{ ...node, name: prefix + node.name }]);
}
const sourceRoot = tree.find(node => node.name === 'src' && node.type === 'directory');
assert.ok(sourceRoot, 'Live deployment source tree is unavailable.');
const manifest = flatten([sourceRoot]).map(file => {
  assert.ok(file.name.startsWith('src/'), 'Unexpected source root');
  return { file: file.name.slice(4), sha: file.uid };
});
const fileMap = new Map(manifest.map(file => [file.file, file]));
async function sourceText(filename) {
  const entry = fileMap.get(filename);
  assert.ok(entry, `Missing production source ${filename}`);
  const body = await api(`/v8/deployments/${live.id}/files/${entry.sha}`);
  return Buffer.from(body.data, 'base64').toString('utf8');
}
const config = JSON.parse(await sourceText('vercel.json'));
assert.ok(!config.rewrites.some(rule => rule.source.startsWith('/kosebasi/strateji')), 'Route already exists; review first.');
config.rewrites.unshift(
  { source: '/kosebasi/strateji', destination: '/kosebasi/strateji/index.html' },
  { source: '/kosebasi/strateji/', destination: '/kosebasi/strateji/index.html' },
);
const overlay = new Map([['vercel.json', Buffer.from(JSON.stringify(config, null, 2) + '\n')]]);
function collect(directory) {
  for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = directory + '/' + entry.name;
    if (entry.isDirectory()) collect(relative);
    else if (entry.isFile()) overlay.set(relative, readFileSync(path.join(root, relative)));
  }
}
collect('public/kosebasi/strateji');
overlay.set('scripts/build-kosebasi-showcase.mjs', readFileSync(path.join(root, 'scripts/build-kosebasi-showcase.mjs')));
for (const name of ['scene.js', 'prepare-media.mjs']) overlay.set('scripts/kosebasi/' + name, readFileSync(path.join(root, 'scripts/kosebasi/' + name)));
const report = { priorProductionDeployment: live.id, publicUrl: 'https://www.intiba.co.uk/kosebasi/strateji/', sourceFileCount: manifest.length, changedFiles: [...overlay.keys()], retainedUnchangedFiles: manifest.filter(file => !overlay.has(file.file)).length, promoted: false, createdAt: new Date().toISOString() };
console.log(JSON.stringify(report, null, 2));
if (!process.argv.includes('--stage')) {
  console.log('Read-only plan complete. Pass --stage to upload the allowlisted files and create an unpromoted production build.');
  process.exit(0);
}
for (const [filename, contents] of overlay) {
  const sha = createHash('sha1').update(contents).digest('hex');
  const result = await fetch('https://api.vercel.com/v2/files' + query, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Content-Length': String(contents.length), 'x-vercel-digest': sha }, body: contents });
  if (!result.ok) throw new Error(`Upload failed for ${filename}: ${result.status}`);
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
    meta: { purpose: 'kosebasi-strategy-showcase', sourceDeployment: live.id, isolatedOverlay: 'true' },
  }),
});
report.newProductionDeployment = deployment.id;
report.stagingUrl = 'https://' + deployment.url;
report.buildStatus = deployment.readyState;
const out = path.join(root, 'docs/kosebasi-showcase');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'deployment.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ id: deployment.id, url: report.stagingUrl, status: deployment.readyState, promoted: false }, null, 2));
