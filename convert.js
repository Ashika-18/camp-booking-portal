const fs = require('fs');
const path = require('path');

const rawDataPath = path.join(__dirname, 'export.json');
const outputPath = path.join(__dirname, 'data', 'sites.json');

try {
  const raw = fs.readFileSync(rawDataPath, 'utf-8');
  const parsed = JSON.parse(raw);

  // name（施設名）が登録されており、かつ英語プレースホルダー等でないものを抽出
  const validElements = (parsed.elements || []).filter(el => {
    return el.tags && el.tags.name && el.tags.name !== 'campeggio';
  });

  // 施設名の重複排除
  const uniqueSites = [];
  const nameSet = new Set();

  for (const el of validElements) {
    const name = el.tags.name.trim();
    if (!nameSet.has(name)) {
      nameSet.add(name);
      uniqueSites.push(el);
    }
  }

  // 商用フリー・イメージ写真プール
  const sampleImages = [
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1496545672447-f699b503d270?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=800&q=80'
  ];

  const formattedSites = uniqueSites.map((el, index) => {
    const tags = el.tags;
    const city = tags['addr:city'] || tags['addr:province'] || '兵庫県内';
    const tel = tags.phone || tags['contact:phone'] || '現地窓口にて受付';
    
    return {
      id: `site-osm-${el.id}`,
      name: `${tags.name}（${city}）`,
      type: "auto_standard",
      capacity: { min: 2, max: 6, unit: "人" },
      price: 3000,
      size: "区画・フリー共用サイト",
      groundType: "芝生・土",
      powerAvailable: false,
      recommendedFor: `${city}に位置する公的登録サイト・自然豊かなロケーション`,
      facilities: ["水洗トイレ完備", "炊事棟", "駐車場完備"],
      rentalOptions: ["持参推奨"],
      notes: `連絡先/受付: ${tel}。直火禁止。ゴミは原則持ち帰りとなります。`,
      imageUrl: sampleImages[index % sampleImages.length]
    };
  });

  fs.writeFileSync(outputPath, JSON.stringify(formattedSites, null, 2), 'utf-8');
  console.log(`✅ 変換成功: ${formattedSites.length}件のキャンプ場データを data/sites.json に保存しました。`);

} catch (err) {
  console.error('❌ エラーが発生しました:', err.message);
}