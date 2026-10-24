const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data', 'sites.json');

if (!fs.existsSync(dataPath)) {
  console.error('data/sites.json が見つかりません。');
  process.exit(1);
}

const rawData = fs.readFileSync(dataPath, 'utf-8');
const sites = JSON.parse(rawData);

// 自治体公営・無料または格安キャンプ場の判定・料金クレンジング
const updatedSites = sites.map(site => {
  const name = site.name || '';
  const rules = site.rules || '';
  const desc = `${name} ${rules} ${site.specs || ''}`;

  // 1. 無料サイトの判定
  if (
    name.includes('古法華') ||
    name.includes('木谷山') ||
    desc.includes('完全無料') ||
    desc.includes('無料')
  ) {
    site.price = '無料（¥0）';
    return site;
  }

  // 2. 青少年野外活動センター・公営広場・野営場（数百円〜格安または要確認）
  if (
    name.includes('野外活動センター') ||
    name.includes('青年の家') ||
    name.includes('県民広場') ||
    name.includes('大師山自然公園')
  ) {
    site.price = '公営・格安（要問い合わせ）';
    return site;
  }

  // 3. コテージ・ロッジを含む施設
  if (name.includes('コテージ') || name.includes('ロッジ')) {
    site.price = '¥5,000〜（宿泊・棟貸し）';
    return site;
  }

  // 4. 一律3000円で埋まっていたその他の公営・不明施設
  if (site.price === '3000' || site.price === 3000 || site.price === '¥3,000〜') {
    site.price = '要問い合わせ（現地確認）';
    return site;
  }

  return site;
});

fs.writeFileSync(dataPath, JSON.stringify(updatedSites, null, 2), 'utf-8');
console.log(`完了: ${updatedSites.length}件の施設データを精査・更新しました。`);