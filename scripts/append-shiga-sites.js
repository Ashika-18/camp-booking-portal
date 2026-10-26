const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sitesFile = path.join(root, 'data', 'sites.json');
const incomingFile = path.join(root, 'data', 'shiga-sites.json');

function enrich(site) {
  const facilities = site.hasFlushingToilet ? ['水洗トイレ完備', '炊事場'] : ['仮設トイレ', '炊事場'];
  if (site.hasPower) facilities.push('AC電源あり');
  if (site.hasGrass) facilities.push('芝生サイト');

  const cottage = (site.tags || []).some((tag) => /コテージ|ロッジ|バンガロー|宿泊棟/.test(tag));
  const notes = Array.isArray(site.rules) ? `${site.rules.join('。')}。` : '';

  return {
    ...site,
    address: site.area,
    type: cottage ? 'cottage' : (site.hasCarAccess ? 'auto_standard' : 'tent'),
    capacity: { min: 2, max: 6, unit: '人' },
    size: site.hasCarAccess ? 'オートサイト（車横付け）' : '持込テントエリア（車の乗り入れ不可）',
    groundType: site.hasGrass ? '芝生・平坦' : '砂利',
    powerAvailable: site.hasPower,
    recommendedFor: site.description,
    facilities,
    rentalOptions: ['持参推奨'],
    notes,
    url: site.officialUrl
  };
}

function stripArea(name) {
  return String(name || '').replace(/（[^）]*）\s*$/g, '');
}

function facilityText(site) {
  return Array.isArray(site.facilities) ? site.facilities.join(' ') : '';
}

function planText(site) {
  return `${stripArea(site.name)} ${site.specs || ''} ${site.type || ''}`;
}

function normalize(site) {
  const ruleText = Array.isArray(site.rules) ? site.rules.join('。') : (site.rules || '');
  const notes = typeof site.notes === 'string' && site.notes ? site.notes : ruleText;
  return {
    ...site,
    address: site.address || site.area || '',
    specs: site.specs || site.size || '',
    rules: notes,
    facilities: Array.isArray(site.facilities) ? site.facilities : []
  };
}

function hasCar(site) {
  const text = `${planText(site)} ${site.rules || ''}`;
  if (/乗入不可|乗り入れ不可|乗り入れはでき|持込テントエリア|青少年野外|野営場/.test(text)) return false;
  return /オートキャンプ|オートサイト|車横付け|車乗り入れ|車乗入/.test(planText(site));
}

function hasFlush(site) {
  const text = `${facilityText(site)} ${site.specs || ''} ${site.rules || ''}`;
  if (/仮設トイレ|汲み取り|バイオトイレ/.test(text)) return false;
  return /水洗トイレ|ウォシュレット|温水洗浄便座|清潔な洋式トイレ|flush_toilet/.test(text);
}

function hasPower(site) {
  const text = `${site.specs || ''} ${facilityText(site)} ${site.rules || ''}`;
  if (/電源なし|電源無|電源はなし|AC電源：なし|AC電源:なし/.test(text)) return false;
  return /電源付きサイト|AC電源あり|各サイト電源|1000W/.test(text);
}

function hasGrass(site) {
  const text = `${site.groundType || ''} ${facilityText(site)}`;
  if (/林間|砂利|川原|ウッドデッキ|傾斜|ゴロゴロ/.test(text)) return false;
  return /芝生サイト|芝生・平坦|天然芝|フラットな草地/.test(text);
}

const existing = JSON.parse(fs.readFileSync(sitesFile, 'utf8'));
const incoming = JSON.parse(fs.readFileSync(incomingFile, 'utf8'));
const base = existing.filter((site) => !String(site.id).startsWith('shiga_'));

if (base.length !== 242) {
  throw new Error(`兵庫県側の件数が 242 ではありません: ${base.length}`);
}
if (incoming.length !== 30) {
  throw new Error(`追加データが 30 件ではありません: ${incoming.length}`);
}

const shiga = incoming.map(enrich);
const mismatches = [];
shiga.map(normalize).forEach((site, index) => {
  const source = incoming[index];
  const checks = [
    ['hasCarAccess', hasCar(site)],
    ['hasFlushingToilet', hasFlush(site)],
    ['hasPower', hasPower(site)],
    ['hasGrass', hasGrass(site)]
  ];
  checks.forEach(([key, actual]) => {
    if (actual !== source[key]) mismatches.push(`${source.id} ${key}: expected ${source[key]} got ${actual}`);
  });
  if (!(site.address || '').includes(source.area)) mismatches.push(`${source.id} address missing ${source.area}`);
});

if (mismatches.length) {
  throw new Error(mismatches.join('\n'));
}

const merged = base.concat(shiga);
if (merged.length !== 272) {
  throw new Error(`合計が 272 ではありません: ${merged.length}`);
}

fs.writeFileSync(sitesFile, `${JSON.stringify(merged, null, 2)}\n`);
console.log(`merged ${base.length} + ${shiga.length} = ${merged.length}`);
