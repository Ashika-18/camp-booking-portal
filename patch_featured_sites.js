const fs = require('fs');
const path = require('path');

const sitesFilePath = path.join(__dirname, 'data', 'sites.json');

try {
  let sites = JSON.parse(fs.readFileSync(sitesFilePath, 'utf-8'));

  // 1. 古法華の重複統合（「古法華キャンプ場」と「古法華自然公園」が混在しているため1つに集約）
  const hasFururokke = sites.some(s => s.name.includes('古法華'));
  if (hasFururokke) {
    sites = sites.filter(s => !s.name.includes('古法華キャンプ場'));
  }

  // 2. 主要公的・注目スポットの正確な実務スペック定義
  const featuredUpdates = [
    {
      targetKeyword: '古法華',
      data: {
        name: '古法華自然公園 キャンプ場（加西市）',
        type: 'free_site',
        capacity: { min: 1, max: 6, unit: '人' },
        price: 0, // 完全無料
        size: '芝生フリーサイト（約30張・車両乗入不可）',
        groundType: '芝生',
        powerAvailable: false,
        recommendedFor: '加西市営の無料キャンプ場。国指定重要文化財の石仏や吊り橋、豊かな自然に囲まれた人気スポット。',
        facilities: ['水洗トイレ', '炊事棟', '無料駐車場', 'バーベキュー広場', '遊歩道・吊り橋'],
        rentalOptions: ['持参必須（レンタルなし）'],
        notes: '完全無料・利用日の2ヶ月前から公式Webフォームにて事前申請必須（電話受付不可）。直火禁止。ゴミは完全持ち帰り。'
      }
    },
    {
      targetKeyword: '福崎町青少年野外活動センター',
      data: {
        name: '福崎町青少年野外活動センター（神崎郡福崎町）',
        type: 'auto_standard',
        capacity: { min: 2, max: 8, unit: '人' },
        price: 1500,
        size: '区画テントサイト・持込テントエリア',
        groundType: '土・芝生',
        powerAvailable: false,
        recommendedFor: '七種山麓の自然林に囲まれた公的施設。青少年育成・ファミリー利用に最適。',
        facilities: ['水洗トイレ', '炊事棟', '管理棟', 'キャンプファイヤー場'],
        rentalOptions: ['要事前確認'],
        notes: '福崎町教育委員会への事前申請が必要。直火禁止、ゴミ持ち帰り。'
      }
    }
  ];

  let updatedCount = 0;
  sites = sites.map(site => {
    for (const update of featuredUpdates) {
      if (site.name.includes(update.targetKeyword)) {
        updatedCount++;
        return {
          ...site,
          ...update.data
        };
      }
    }
    return site;
  });

  fs.writeFileSync(sitesFilePath, JSON.stringify(sites, null, 2), 'utf-8');
  console.log('✅ スペック更新完了: ' + updatedCount + ' 件の主要スポットを公式正確スペックに反映しました（加西市古法華の重複も整理済）。');

} catch (err) {
  console.error('❌ 更新エラー: ', err.message);
}