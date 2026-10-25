const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'sites.json');
const sites = JSON.parse(fs.readFileSync(file, 'utf8'));

const blocked = /青少年|野外活動|野外教育|教育キャンプ|デイキャンプ|少年自然|青年の家|自然の家|体験センター|いこいの家|アドベンチャー|乗入不可|持込テント|バックパッカー|登山口|海水浴|潮干|広場|子ども|こども|市立|町立|県立|県民|公園/;
const explicit = /オート|RVパーク|\bRV\b|車横付け|車乗り入れ/;
const brand = /グランピング|リゾート|ヴィレッジ|ビレッジ|コテージ|ロッジ|CAMP|Camp|FIELD|Field|BASE|Base|フィールド/;
const walk = /川|渓谷|滝|渓流|ダム|登山|浜|ビーチ|海岸/;
const plainExclude = /一般キャンプ場|テントキャンプ場|わんぱく|奥山キャンプ|馬場山|春日山|社家郷山|木谷山|甲山|知明湖|アルプス/;
const rough = /川|渓谷|滝|渓流|ダム|湖|浜|ビーチ|海岸|林間|砂利|登山|森林公園/;
const hardNoFlush = /青少年|野外活動|野外教育|教育キャンプ|デイキャンプ|少年自然|青年の家|自然の家|体験センター|いこいの家|アドベンチャー|バックパッカー|登山口|海水浴|潮干|広場|子ども|こども|野営/;
const powerHint = /温泉|パーク|村|シーサイド|田園|草原|高原|ランド|グランピング|リゾート|\bRV\b|ヴィレッジ|ビレッジ|コテージ|ロッジ|FIELD|フィールド|CAMP|Camp|BASE|Base|オート/;

function strip(name) {
  return String(name || '').replace(/（[^）]*）\s*$/g, '');
}

function classify(site) {
  const name = strip(site.name);
  const notes = `${site.size || ''} ${site.notes || ''}`;
  const noDrive = /乗入不可|乗り入れ不可|乗り入れはでき/.test(`${name} ${notes}`);
  const hasCar = !noDrive
    && !blocked.test(name)
    && !plainExclude.test(name)
    && (explicit.test(name) || brand.test(name) || (/キャンプ場/.test(name) && !walk.test(name)));
  const strongPower = /オート|\bRV\b|グランピング|リゾート|ヴィレッジ|ビレッジ|コテージ|ロッジ|CAMP|Camp|FIELD|フィールド|BASE|Base/;
  const weakPower = /Campground|THE CHILL CAMP|N& CAMP FIELD|Container Base/;
  const offsitePower = /KOBE TERRACE|ササヤマベース|Chillout camp|グリーンテラス神戸|ハチ高原 THE PARK|山崎アウトドアランド|リフレッシュパーク市川|グラン・ドーム|GRAND CHARIOT|PALM HOUSE|フリーライド|モビレージ/;
  const hasPower = offsitePower.test(name) || (hasCar && !/ソロ/.test(name) && strongPower.test(name) && !weakPower.test(name));
  const hasGrass = !rough.test(name) && !/林間|砂利|ウッドデッキ|傾斜|川原/.test(name) && hasCar;
  const managed = /キャンプ|オート|グランピング|リゾート|CAMP|Camp|フィールド|BASE|Base|テラス|TERRACE|パーク|PARK|ヴィレッジ|ビレッジ|ランド|ハウス|House|ドーム|里/;
  const hasFlush = !hardNoFlush.test(name) && managed.test(name);
  return { hasCar, hasPower, hasGrass, hasFlush, name };
}

for (const site of sites) {
  const flags = classify(site);
  const name = flags.name;
  const keepSize = /乗入不可|乗り入れ不可/.test(site.size || '');

  site.hasCarAccess = flags.hasCar;
  site.hasFlushingToilet = flags.hasFlush;
  site.hasPower = flags.hasPower;
  site.hasGrass = flags.hasGrass;
  site.powerAvailable = flags.hasPower;

  if (!keepSize) {
    site.size = flags.hasCar
      ? 'オートサイト（車横付け）'
      : '持込テントエリア（車の乗り入れ不可）';
  }
  if (flags.hasCar) site.type = site.type === 'free_site' ? site.type : 'auto_standard';
  else if (site.type === 'auto_standard') site.type = 'tent';

  if (/川|渓谷|滝|渓流|ダム|湖/.test(name)) site.groundType = '川原（石）';
  else if (/浜|ビーチ|海岸|海水浴/.test(name)) site.groundType = '砂利';
  else if (flags.hasGrass) site.groundType = '芝生・平坦';
  else site.groundType = '林間（土）';

  const facilities = Array.isArray(site.facilities) ? site.facilities.filter(item => !/トイレ|電源|芝生/.test(item)) : [];
  facilities.unshift(flags.hasFlush ? '水洗トイレ完備' : (/青少年|野外|教育|野営/.test(name) ? '汲み取り式トイレ' : '仮設トイレ'));
  if (flags.hasPower) facilities.push('電源付きサイト（1000W目安）');
  if (flags.hasGrass) facilities.push('芝生サイト');
  site.facilities = facilities;
}

const n = sites.length;
const count = (key) => sites.filter(site => site[key]).length;
const trio = sites.filter(site => site.hasCarAccess && site.hasFlushingToilet && site.hasPower).length;
const report = {
  car: `${count('hasCarAccess')} (${(100 * count('hasCarAccess') / n).toFixed(1)}%)`,
  flush: `${count('hasFlushingToilet')} (${(100 * count('hasFlushingToilet') / n).toFixed(1)}%)`,
  power: `${count('hasPower')} (${(100 * count('hasPower') / n).toFixed(1)}%)`,
  grass: `${count('hasGrass')} (${(100 * count('hasGrass') / n).toFixed(1)}%)`,
  trio: `${trio} (${(100 * trio / n).toFixed(1)}%)`
};
console.log(report);

fs.writeFileSync(file, `${JSON.stringify(sites, null, 2)}\n`);
