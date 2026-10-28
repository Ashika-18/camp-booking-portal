/**
 * セキュリティヘッダーの単一の定義。
 * このリポジトリは Next.js ではないため next.config.js の headers() は使わない。
 * Express（ローカル）と Render Static Site（render.yaml）と public/_headers が同じ値を使う。
 *
 * script-src の https://cdn.tailwindcss.com は、index.html が読み込む Tailwind CDN だけを追加している。
 * ここを外すとユーティリティクラスが当たらず、既存の画面が崩れる。
 * googletagmanager.com / google-analytics.com は GTM と、コンテナ内の GA4 送信先。
 * コンテナ未設定やブロック時も、ページ本体の script は 'self' のまま動く。
 */
const ALLOWED_IMAGE_HOSTS = Object.freeze(['images.unsplash.com']);

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://www.googletagmanager.com https://tagmanager.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://images.unsplash.com https://*.unsplash.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
  "frame-src 'self' https://www.googletagmanager.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

const SECURITY_HEADERS = Object.freeze([
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
  ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload'],
  ['Content-Security-Policy', CONTENT_SECURITY_POLICY]
]);

function isAllowedImageUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

function withAllowedImage(site) {
  if (!site || typeof site !== 'object') return site;
  const next = { ...site };
  for (const key of ['imageUrl', 'image']) {
    if (typeof next[key] === 'string' && next[key] !== '' && !isAllowedImageUrl(next[key])) {
      next[key] = '';
    }
  }
  return next;
}

function renderHeadersFile() {
  const lines = [
    '# 全パス向け。Render 本番は render.yaml の headers が適用される。',
    '# このファイルは同じ方針の控え（Netlify 互換形式）。',
    '/*',
    ...SECURITY_HEADERS.map(([name, value]) => `  ${name}: ${value}`),
    ''
  ];
  return lines.join('\n');
}

function yamlQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function renderBlueprint() {
  const headerYaml = SECURITY_HEADERS.map(([name, value]) => [
    '      - path: /*',
    `        name: ${name}`,
    `        value: ${yamlQuote(value)}`
  ].join('\n')).join('\n');

  return [
    '# Render Static Site。next.config.js の headers() は使わない。',
    '# Dashboard で Blueprint を同期すると、以下の headers が全パスに付く。',
    'services:',
    '  - type: web',
    '    name: camp-booking-portal',
    '    runtime: static',
    '    buildCommand: npm run build',
    '    staticPublishPath: ./public',
    '    headers:',
    headerYaml,
    ''
  ].join('\n');
}

module.exports = {
  ALLOWED_IMAGE_HOSTS,
  CONTENT_SECURITY_POLICY,
  SECURITY_HEADERS,
  isAllowedImageUrl,
  withAllowedImage,
  renderHeadersFile,
  renderBlueprint
};
