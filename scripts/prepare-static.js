const fs = require('fs');
const path = require('path');
const { withAllowedImage, renderHeadersFile, renderBlueprint } = require('./security-policy');

const root = path.join(__dirname, '..');
const sitesFile = path.join(root, 'data', 'sites.json');
const publicDir = path.join(root, 'public');
const dataDir = path.join(publicDir, 'data');
const publishedSites = path.join(dataDir, 'sites.json');

const sites = JSON.parse(fs.readFileSync(sitesFile, 'utf8'));
if (!Array.isArray(sites)) {
  throw new Error('data/sites.json は配列である必要があります。');
}

const payload = {
  success: true,
  data: sites.map(withAllowedImage)
};

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(publishedSites, JSON.stringify(payload));
fs.writeFileSync(path.join(publicDir, '_headers'), renderHeadersFile());
fs.writeFileSync(path.join(root, 'render.yaml'), renderBlueprint());

console.log(`[static] ${payload.data.length} 件を public/data/sites.json に書き出しました。`);
console.log('[static] public/_headers と render.yaml を更新しました。');
