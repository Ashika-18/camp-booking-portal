const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { SECURITY_HEADERS, withAllowedImage } = require('./scripts/security-policy');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

// キャンプ場公式窓口情報
const CAMP_INFO = {
  name: 'フォレストヴィレッジ ファミリーキャンプ場',
  tel: '0120-123-456',
  email: 'reserve@camp-example.com',
  businessHours: '9:00〜18:00 (年中無休)'
};

// ディレクトリおよびJSONファイルのパス
const DATA_DIR = path.join(__dirname, 'data');
const SITES_FILE = path.join(DATA_DIR, 'sites.json');
const INQUIRIES_FILE = path.join(DATA_DIR, 'inquiries.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ミドルウェア設定
app.use((req, res, next) => {
  for (const [name, value] of SECURITY_HEADERS) {
    res.setHeader(name, value);
  }
  next();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静的ファイルの配信設定
app.use(express.static(PUBLIC_DIR));

/**
 * データ保存領域と初期JSONファイルの存在を検証・自動生成するユーティリティ
 */
async function ensureDataFilesExist() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    // sites.json の確認
    try {
      await fs.access(SITES_FILE);
    } catch {
      const defaultSites = [
        {
          id: 'site-power-a',
          name: '電源付きオートサイト A区画',
          type: 'auto_power',
          capacity: { min: 2, max: 6, unit: '人' },
          price: 6800,
          size: '10m × 10m (100㎡) 車両1台駐車可',
          groundType: '芝生（ペグ打ち良好）',
          powerAvailable: true,
          recommendedFor: '初心者ファミリー人気No.1！スマホ充電やホットプレート調理も安心',
          facilities: ['100V/1500W電源', '水洗洋式トイレ徒歩2分', '温水コインシャワー棟近接', '給湯付き炊事場', '車両横付けOK'],
          rentalOptions: ['ファミリーテントセット (4〜5人用)', 'LEDランタン2個セット', 'BBQグリル・トングセット', '折りたたみチェア＆テーブル'],
          notes: '車2台以上の場合は追加駐車場（1台500円/日）の事前申告が必要です。焚き火は焚き火台と耐火シートをご使用ください。',
          imageUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'site-standard-b',
          name: '広々オートサイト B区画（電源なし）',
          type: 'auto_standard',
          capacity: { min: 2, max: 6, unit: '人' },
          price: 5200,
          size: '11m × 10m (110㎡) 車両1台駐車可',
          groundType: '芝生・一部硬質土',
          powerAvailable: false,
          recommendedFor: '自然の開放感を楽しみたいご家族に！大型2ルームテントも余裕の広さ',
          facilities: ['車両横付けOK', '水洗洋式トイレ徒歩3分', '温水コインシャワー棟徒歩4分', '屋根付き共同炊事場'],
          rentalOptions: ['大型ポータブル電源 (500Wh)', 'ファミリーテントセット (4〜5人用)', '焚き火台セット', '寝袋（スリーピングバッグ）'],
          notes: '地面が一部硬質のため、鍛造ペグの使用を推奨します（管理棟にてレンタルあり）。',
          imageUrl: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'site-cottage-c',
          name: 'ファミリーロッジ（冷暖房・キッチン完備）',
          type: 'cottage',
          capacity: { min: 2, max: 5, unit: '人' },
          price: 16500,
          size: '室内6畳＋ウッドデッキ6畳 車両1台駐車可',
          groundType: 'ウッドデッキ・室内フローリング',
          powerAvailable: true,
          recommendedFor: 'テント設営が不安な完全初心者や、小さなお子様連れの初めてのお泊まりに最適',
          facilities: ['冷暖房エアコン', '室内キッチン・ミニ冷蔵庫', '室内温水洗浄便座トイレ', '専用ウッドデッキ（屋根付きBBQ可能）', 'AC100Vコンセント多数'],
          rentalOptions: ['デッキ用BBQガスコンロ', '追加毛布・シーツセット', '子ども用アウトドアチェア'],
          notes: '室内は土足・ペット禁止です。ウッドデッキ上でのみBBQをお楽しみいただけます（直火不可）。',
          imageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'site-free-d',
          name: '林間フリーテントサイト',
          type: 'free_tent',
          capacity: { min: 1, max: 4, unit: '人' },
          price: 3800,
          size: 'フリー区画（テント1張＋タープ1張目安）',
          groundType: '木漏れ日の腐葉土・平坦',
          powerAvailable: false,
          recommendedFor: '木陰で涼しく過ごしたいファミリー・静かなキャンプを楽しみたい方',
          facilities: ['共同水洗トイレ徒歩4分', 'コインシャワー棟徒歩5分', '荷物運搬用アウトドアワゴン無料貸出'],
          rentalOptions: ['テント設営アシストサービス', 'アウトドアワゴン', 'LEDランタン'],
          notes: '車両の乗り入れはできません。駐車場から専用ワゴンで荷物を運搬してください（徒歩約1〜2分）。',
          imageUrl: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=800&q=80'
        }
      ];
      await fs.writeFile(SITES_FILE, JSON.stringify(defaultSites, null, 2), 'utf8');
      console.log('[INIT] sites.json を初期生成しました。');
    }

    // inquiries.json の確認
    try {
      await fs.access(INQUIRIES_FILE);
    } catch {
      await fs.writeFile(INQUIRIES_FILE, JSON.stringify([], null, 2), 'utf8');
      console.log('[INIT] inquiries.json を初期生成しました。');
    }
  } catch (err) {
    console.error('[INIT_ERROR] データディレクトリ・ファイルの初期化に失敗しました:', err);
  }
}

/**
 * JSONファイルを非同期で安全に読み込むヘルパー
 */
async function readJsonFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * JSONファイルへ非同期で安全に書き込むヘルパー
 */
async function writeJsonFile(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content, 'utf8');
}

// ==========================================
// REST API エンドポイント
// ==========================================

/**
 * GET /api/sites
 * キャンプサイト一覧取得（type による絞り込み対応）
 */
app.get('/api/sites', async (req, res) => {
  try {
    const sites = (await readJsonFile(SITES_FILE)).map(withAllowedImage);
    const { type } = req.query;

    if (type && typeof type === 'string') {
      const filtered = sites.filter((s) => s.type === type.trim());
      return res.status(200).json({
        success: true,
        data: filtered
      });
    }

    return res.status(200).json({
      success: true,
      data: sites
    });
  } catch (error) {
    console.error('GET /api/sites Error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_READ_ERROR',
        message: 'サイト情報の読み込みに失敗しました。'
      }
    });
  }
});

/**
 * GET /api/sites/:id
 * キャンプサイト詳細取得
 */
app.get('/api/sites/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sites = await readJsonFile(SITES_FILE);
    const site = withAllowedImage(sites.find((s) => s.id === id));

    if (!site) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SITE_NOT_FOUND',
          message: '指定されたキャンプサイトが見つかりません。'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: site
    });
  } catch (error) {
    console.error(`GET /api/sites/${req.params.id} Error:`, error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_READ_ERROR',
        message: 'サイト情報の読み込みに失敗しました。'
      }
    });
  }
});

/**
 * POST /api/inquiries
 * 予約問い合わせ・下書きログ保存 & mailto/tel URLおよび案内文生成
 */
app.post('/api/inquiries', async (req, res) => {
  try {
    const {
      siteId,
      customerName,
      customerTel,
      customerEmail,
      checkInDate,
      nights = 1,
      adults = 2,
      children = 0,
      carCount = 1,
      rentals = [],
      questions = '',
      channel = 'email'
    } = req.body;

    const validationErrors = [];

    // 必須入力チェック
    if (!siteId || typeof siteId !== 'string' || siteId.trim() === '') {
      validationErrors.push('siteId は必須です。');
    }
    if (!customerName || typeof customerName !== 'string' || customerName.trim() === '') {
      validationErrors.push('customerName は必須です。');
    }
    if (!customerTel || typeof customerTel !== 'string' || customerTel.trim() === '') {
      validationErrors.push('customerTel は必須です。');
    }
    if (!customerEmail || typeof customerEmail !== 'string' || customerEmail.trim() === '') {
      validationErrors.push('customerEmail は必須です。');
    }
    if (!checkInDate || typeof checkInDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(checkInDate.trim())) {
      validationErrors.push('checkInDate は有効な日付形式（YYYY-MM-DD）で指定してください。');
    }

    const numNights = Number(nights);
    if (isNaN(numNights) || numNights < 1) {
      validationErrors.push('nights は1以上の数値を指定してください。');
    }

    const numAdults = Number(adults);
    if (isNaN(numAdults) || numAdults < 1) {
      validationErrors.push('adults は1以上の数値を指定してください。');
    }

    const numChildren = Number(children);
    if (isNaN(numChildren) || numChildren < 0) {
      validationErrors.push('children は0以上の数値を指定してください。');
    }

    const numCars = Number(carCount);
    if (isNaN(numCars) || numCars < 0) {
      validationErrors.push('carCount は0以上の数値を指定してください。');
    }

    if (!Array.isArray(rentals)) {
      validationErrors.push('rentals は配列形式で指定してください。');
    }

    if (!['email', 'phone_draft'].includes(channel)) {
      validationErrors.push('channel は "email" または "phone_draft" を指定してください。');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: '入力内容に不備があります。',
          details: validationErrors
        }
      });
    }

    // 対象キャンプサイトの存在確認
    const sites = await readJsonFile(SITES_FILE);
    const targetSite = sites.find((s) => s.id === siteId.trim());

    if (!targetSite) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SITE_NOT_FOUND',
          message: '指定されたキャンプサイトが見つかりません。'
        }
      });
    }

    // 問い合わせIDと作成日時を自動採番
    const inquiryId = `inq_${Date.now()}`;
    const createdAt = new Date().toISOString();

    const newInquiry = {
      id: inquiryId,
      createdAt,
      siteId: targetSite.id,
      siteName: targetSite.name,
      customerName: customerName.trim(),
      customerTel: customerTel.trim(),
      customerEmail: customerEmail.trim(),
      checkInDate: checkInDate.trim(),
      nights: numNights,
      adults: numAdults,
      children: numChildren,
      carCount: numCars,
      rentals: Array.isArray(rentals) ? rentals : [],
      questions: typeof questions === 'string' ? questions.trim() : '',
      channel
    };

    // inquiries.json へ追記保存
    const inquiries = await readJsonFile(INQUIRIES_FILE);
    inquiries.push(newInquiry);
    await writeJsonFile(INQUIRIES_FILE, inquiries);

    // mailto: URL の生成
    const emailSubject = `【宿泊予約申込】${targetSite.name} (${newInquiry.customerName}様)`;
    const rentalsText = newInquiry.rentals.length > 0 ? newInquiry.rentals.join(', ') : '希望なし（持参）';
    const emailBody = [
      `${CAMP_INFO.name} 予約担当窓口 御中`,
      '',
      'Webポータルより以下の内容で宿泊予約の問い合わせ・申し込みをいたします。',
      '空き状況および合計概算料金のご案内をお願い申し上げます。',
      '',
      '--------------------------------------------------',
      '【予約希望内容】',
      `・希望サイト: ${targetSite.name} (基本料金: ¥${targetSite.price.toLocaleString()}〜/泊)`,
      `・チェックイン希望日: ${newInquiry.checkInDate} から ${newInquiry.nights}泊`,
      `・利用人数: 大人 ${newInquiry.adults}名 / お子様 ${newInquiry.children}名 (合計 ${newInquiry.adults + newInquiry.children}名)`,
      `・ご利用車両台数: ${newInquiry.carCount}台`,
      `・希望レンタル品: ${rentalsText}`,
      '--------------------------------------------------',
      '【代表者様情報】',
      `・お名前: ${newInquiry.customerName} 様`,
      `・お電話番号: ${newInquiry.customerTel}`,
      `・メールアドレス: ${newInquiry.customerEmail}`,
      '--------------------------------------------------',
      '【ご質問・配慮事項など】',
      newInquiry.questions || '特になし',
      '--------------------------------------------------'
    ].join('\r\n');

    const mailtoUrl = `mailto:${CAMP_INFO.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    // 電話案内テキストの生成
    const phoneGuideText = `お電話時に「${newInquiry.checkInDate}から${newInquiry.nights}泊、${targetSite.name}の予約検討」とお伝えいただくと、スタッフが速やかに空き状況と設備案内を差し上げます。`;
    const cleanTel = CAMP_INFO.tel.replace(/[^0-9]/g, '');
    const telUrl = `tel:${cleanTel}`;

    return res.status(201).json({
      success: true,
      data: {
        inquiryId,
        siteName: targetSite.name,
        mailtoUrl,
        phoneGuideText,
        telUrl,
        campInfo: CAMP_INFO
      }
    });
  } catch (error) {
    console.error('POST /api/inquiries Error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_SAVE_ERROR',
        message: '問い合わせデータの保存に失敗しました。'
      }
    });
  }
});

/**
 * GET /api/inquiries
 * 問い合わせ履歴一覧取得（管理・確認用）
 */
app.get('/api/inquiries', async (req, res) => {
  try {
    const inquiries = await readJsonFile(INQUIRIES_FILE);
    return res.status(200).json({
      success: true,
      data: inquiries
    });
  } catch (error) {
    console.error('GET /api/inquiries Error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_READ_ERROR',
        message: '問い合わせ履歴の読み込みに失敗しました。'
      }
    });
  }
});

// サーバー起動処理
(async () => {
  await ensureDataFilesExist();
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🌲 Camp Booking Portal Backend is running!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`📂 Static Root: ${PUBLIC_DIR}`);
    console.log(`💾 Data Path:   ${DATA_DIR}`);
    console.log(`====================================================`);
  });
})();