document.addEventListener('DOMContentLoaded', () => {
    const FAVORITE_STORAGE_KEY = 'camp-booking-favorites';
    const MAX_KEYWORD_LENGTH = 50;
    const ALLOWED_IMAGE_HOSTS = new Set(['images.unsplash.com']);
    let allSites = [];
    const activeFilters = new Set();
    const favoriteIds = loadFavoriteIds();
    let favoriteOnly = false;
  
    const sitesContainer = document.getElementById('sites-container');
    const resultCounter = document.getElementById('result-counter');
    const cityFilter = document.getElementById('city-filter');
    const searchInput = document.getElementById('search-input');
    const filterBtns = document.querySelectorAll('.filter-btn');
  
    const modal = document.getElementById('booking-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const targetSiteName = document.getElementById('target-site-name');
    const modalSiteDetails = document.getElementById('modal-site-details');
    const btnCreateMemo = document.getElementById('btn-create-memo');
    const memoOutput = document.getElementById('memo-output');
    const memoText = document.getElementById('memo-text');
    const bookingActions = document.getElementById('booking-actions');
    const favoriteBar = document.getElementById('favorite-bar');
    const favoriteCountText = document.getElementById('favorite-count-text');
    const btnToggleFavoriteFilter = document.getElementById('btn-toggle-favorite-filter');
    const btnClearFavorites = document.getElementById('btn-clear-favorites');
  
    let selectedSite = null;

    const DATALAYER_KEYS = [
      'campsite_name',
      'campsite_area',
      'link_url',
      'tel_number',
      'filter_tag_name',
      'filter_status',
      'selected_area'
    ];

    function pushDataLayer(eventName, params) {
      try {
        window.dataLayer = window.dataLayer || [];
        const payload = { event: eventName };
        DATALAYER_KEYS.forEach((key) => {
          payload[key] = undefined;
        });
        Object.assign(payload, params || {});
        window.dataLayer.push(payload);
      } catch (err) {
        // GTM 未読込や広告ブロッカーでも、検索・遷移・保存は継続する
      }
    }

    function campsiteName(site) {
      return site && site.name ? String(site.name) : '';
    }

    function campsiteAreaLabel(site) {
      if (!site) return '';
      const city = String(site.area || '').trim();
      const pref = String(site.prefecture || '').trim();
      if (city && pref) return `${city}・${pref}`;
      return String(site.address || city || pref || '').trim();
    }

    function filterTagName(type, fallbackEl) {
      if (type) {
        const match = document.querySelector('.filter-btn[data-type="' + type + '"]');
        if (match) return (match.textContent || '').trim();
      }
      const heading = fallbackEl && fallbackEl.querySelector ? fallbackEl.querySelector('h3') : null;
      if (heading) return (heading.textContent || '').trim();
      return type ? String(type) : '';
    }

    function siteFromElement(node) {
      try {
        const card = node && node.closest ? node.closest('.site-card') : null;
        if (!card) return selectedSite;
        const idNode = card.querySelector('[data-id]');
        if (!idNode) return selectedSite;
        const siteId = idNode.getAttribute('data-id');
        return allSites.find(s => String(s.id) === String(siteId)) || selectedSite;
      } catch (err) {
        return selectedSite;
      }
    }

    function isExternalHttpUrl(href) {
      try {
        const parsed = new URL(href, window.location.href);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        return parsed.origin !== window.location.origin;
      } catch (err) {
        return false;
      }
    }

    document.addEventListener('click', (event) => {
      try {
        const target = event.target;
        const link = target && target.closest ? target.closest('a') : null;
        if (!link) return;
        const track = link.getAttribute('data-gtm-event');
        const hrefAttr = link.getAttribute('href') || '';
        const inCard = !!(link.closest && link.closest('.site-card'));
        const site = siteFromElement(link);
        if (track === 'click_official_site' || (inCard && isExternalHttpUrl(link.href))) {
          pushDataLayer('click_official_site', {
            campsite_name: link.getAttribute('data-campsite-name') || campsiteName(site),
            campsite_area: link.getAttribute('data-campsite-area') || campsiteAreaLabel(site),
            link_url: link.getAttribute('data-link-url') || link.href || ''
          });
          return;
        }
        if (track === 'click_tel' || hrefAttr.toLowerCase().indexOf('tel:') === 0) {
          pushDataLayer('click_tel', {
            campsite_name: link.getAttribute('data-campsite-name') || campsiteName(site),
            tel_number: link.getAttribute('data-tel-number') || hrefAttr.replace(/^tel:/i, '')
          });
        }
      } catch (err) {
        // 計測に失敗してもリンクの通常遷移は止めない
      }
    });
  
    // 1. データ取得（配列直接・オブジェクト内包のどちらの形式でも安全に展開）
    async function loadSitesPayload() {
      const urls = ['/api/sites', '/data/sites.json'];
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const type = res.headers.get('content-type') || '';
          if (!type.includes('json')) continue;
          return await res.json();
        } catch (err) {
          // Express が無い Static Site では次の経路を使う
        }
      }
      throw new Error('施設データを取得できませんでした。');
    }

    async function fetchSites() {
      try {
        const data = await loadSitesPayload();
  
        let rawSites = [];
        if (Array.isArray(data)) {
          rawSites = data;
        } else if (Array.isArray(data.sites)) {
          rawSites = data.sites;
        } else if (Array.isArray(data.data)) {
          rawSites = data.data;
        }
        allSites = rawSites.map(normalizeSite);
        pruneFavorites();
        updateFavoriteBar();
  
        applyFilters();
      } catch (err) {
        console.error('Fetch error:', err);
        sitesContainer.innerHTML = '<p style="color: #dc2626; text-align: center; padding: 24px;">施設データの読み込みに失敗しました。ページを再読み込みするか、配信ファイルを確認してください。</p>';
      }
    }
  
    function escapeRegExp(value) {
      return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function sanitizeKeyword(raw) {
      return String(raw || '').trim().slice(0, MAX_KEYWORD_LENGTH);
    }

    // 2. フィルタリングと描画
    function applyFilters() {
      const selectedCity = cityFilter.value.trim();
      const keyword = sanitizeKeyword(searchInput.value).toLowerCase();
      const keywordPattern = keyword ? new RegExp(escapeRegExp(keyword), 'i') : null;

      const filtered = allSites.filter(site => {
        const address = site.address || '';
        const name = site.name || '';
        // 市町村絞り込み
        if (selectedCity && !address.includes(selectedCity) && !name.includes(selectedCity)) {
          return false;
        }
        for (const type of activeFilters) {
          const matcher = filterMatchers[type];
          if (matcher && !matcher(site)) return false;
        }
        // キーワード検索（メタ文字はリテラルとして扱う）
        if (keywordPattern) {
          const facilities = Array.isArray(site.facilities) ? site.facilities.join(' ') : '';
          const targetString = `${name} ${address} ${site.recommend || ''} ${site.specs || ''} ${facilities}`.toLowerCase();
          if (!keywordPattern.test(targetString)) return false;
        }
        if (favoriteOnly && !favoriteIds.has(String(site.id))) return false;
        return true;
      });
  
      renderSites(filtered);
    }
  
    // 3. カード描画（施設タイプや名前に合わせた最適画像の自動割り当て）
  const campImages = [
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=80', // テントと森
    'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=600&q=80', // 焚き火とキャンプ
    'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=600&q=80', // 星空とテント
    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=600&q=80', // 高原・山岳キャンプ
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80', // 山と青空
    'https://images.unsplash.com/photo-1496080174650-637e3f22fa03?auto=format&fit=crop&w=600&q=80', // コテージ・ロッジ風
    'https://images.unsplash.com/photo-1537905569824-f89f14cceb68?auto=format&fit=crop&w=600&q=80', // 川辺・水辺の自然
    'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=600&q=80'  // 芝生・ファミリー向けサイト
  ];

  function isAllowedImageUrl(url) {
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.origin === window.location.origin) return true;
      return parsed.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.has(parsed.hostname);
    } catch (err) {
      return false;
    }
  }

  function getSiteImage(site, index) {
    const candidate = (site.image || '').trim();
    if (candidate && isAllowedImageUrl(candidate)) return candidate;
    const name = site.name || '';
    if (name.includes('コテージ') || name.includes('村')) return campImages[5];
    if (name.includes('高原') || name.includes('山')) return campImages[3];
    if (name.includes('川') || name.includes('渓流') || name.includes('湖')) return campImages[6];
    if (name.includes('公園') || name.includes('広場')) return campImages[7];
    return campImages[index % campImages.length];
  }

  function buildCardBadges(site) {
    const badges = [];
    const name = site.name || '';
    const type = site.type || '';
    const price = String(site.price || '');

    if (hasPowerAmenity(site)) {
      badges.push('<span class="card-badge badge-power">⚡ AC電源あり</span>');
    }
    if (price.includes('無料') || /(?:¥|￥)\s*0(?!\d)|(?:^|[^\d])0円/.test(price)) {
      badges.push('<span class="card-badge badge-free">無料</span>');
    }
    if (hasCarAccessAmenity(site)) {
      badges.push('<span class="card-badge badge-auto">🚗 車横付け</span>');
    }
    if (/コテージ|ロッジ/.test(`${name} ${type}`)) {
      badges.push('<span class="card-badge badge-cottage">🏠 コテージ</span>');
    }

    return badges.length ? `<div class="card-badges">${badges.join('')}</div>` : '';
  }

  function buildFacilityIcons(site) {
    const specs = site.specs || '';
    const rules = site.rules || '';
    const recommend = site.recommend || '';
    const name = site.name || '';
    const facilities = Array.isArray(site.facilities) ? site.facilities.join(' ') : '';
    const hasToilet = hasFlushToiletAmenity(site);
    const hasBath = /温泉|風呂|シャワー|入浴/.test(`${specs} ${rules} ${recommend} ${facilities} ${name}`);
    const hasCar = hasCarAccessAmenity(site);

    const icon = (available, kind, label) =>
      `<span class="facility-icon icon-${kind} ${available ? 'is-available' : 'is-unavailable'}">${label}</span>`;

    return `<div class="facility-icons">${[
      icon(hasToilet, 'toilet', '🚻 水洗トイレ'),
      icon(hasBath, 'bath', '♨️ 温泉・風呂'),
      icon(hasCar, 'car', '🚗 車横付け')
    ].join('')}</div>`;
  }

  function renderSites(sites) {
    resultCounter.textContent = `該当件数: ${sites.length}件 / 全${allSites.length}件`;

    if (sites.length === 0) {
      sitesContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #64748b; padding: 40px 0;">条件に一致するキャンプ場が見つかりませんでした。</p>';
      return;
    }

    sitesContainer.innerHTML = sites.map((site, index) => {
      const facilityTags = (site.facilities || [])
        .map(f => `<span class="facility-tag">${escapeHTML(f)}</span>`)
        .join('');

      const imageUrl = getSiteImage(site, index);
      const badgesHtml = buildCardBadges(site);
      const isFav = favoriteIds.has(String(site.id));
      const siteId = escapeHTML(site.id);

      return `
        <article class="site-card">
          <div class="site-card-image">
            <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(site.name)}" loading="lazy">
            ${badgesHtml}
            <button type="button" class="btn-favorite${isFav ? ' is-active' : ''}" data-id="${siteId}" title="${isFav ? 'キープ解除' : 'キープする'}" aria-pressed="${isFav ? 'true' : 'false'}" aria-label="${isFav ? 'キープ解除' : 'キープする'}">${isFav ? '❤️' : '🤍'}</button>
          </div>
          <div class="site-card-body">
            <h4>${escapeHTML(site.name)}</h4>
            <div class="site-recommend">${escapeHTML(site.recommend || 'おすすめファミリーサイト')}</div>
            ${buildFacilityIcons(site)}
            <ul class="site-specs">
              <li>📍 所在地: ${escapeHTML(site.address || '兵庫県内')}</li>
              <li>⛺ 広さ・区画: ${escapeHTML(site.specs || 'フリーサイト')}</li>
              <li>⚡ AC電源: ${site.power ? 'あり' : 'なし'}</li>
            </ul>
            <div class="site-facilities">
              ${facilityTags}
            </div>
            ${site.rules ? `<div class="site-rules">⚠️ <strong>利用ルール:</strong> ${escapeHTML(site.rules)}</div>` : ''}
            <div class="site-card-footer">
              <div class="price">${escapeHTML(site.price || '料金要確認')}</div>
              <button type="button" class="btn btn-open-modal" data-id="${siteId}">詳細・予約メモ</button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // モーダルオープン設定
    document.querySelectorAll('.btn-open-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        const siteId = btn.getAttribute('data-id');
        openModal(siteId);
        const site = allSites.find(s => String(s.id) === String(siteId));
        pushDataLayer('click_memo', { campsite_name: campsiteName(site) });
      });
    });
  }
  
    // 4. モーダル制御
    function openModal(siteId) {
      selectedSite = allSites.find(s => String(s.id) === String(siteId));
      if (!selectedSite) return;
  
      targetSiteName.textContent = selectedSite.name;
      modalSiteDetails.innerHTML = `
        <p style="margin: 0 0 6px 0;"><strong>所在地:</strong> ${escapeHTML(selectedSite.address || '要確認')}</p>
        <p style="margin: 0 0 6px 0;"><strong>利用料金:</strong> ${escapeHTML(selectedSite.price || '要確認')}</p>
        <p style="margin: 0 0 6px 0;"><strong>区画仕様:</strong> ${escapeHTML(selectedSite.specs || '要確認')}</p>
        <p style="margin: 0 0 6px 0;"><strong>設備:</strong> ${(selectedSite.facilities || []).map((facility) => escapeHTML(facility)).join('、') || '特になし'}</p>
        ${selectedSite.tel ? `<p style="margin: 0 0 6px 0;"><strong>電話番号:</strong> ${escapeHTML(selectedSite.tel)}</p>` : ''}
        ${selectedSite.rules ? `<div style="margin-top: 8px; padding: 8px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 4px; font-size: 0.82rem; color: #92400e;"><strong>⚠️ 注意事項:</strong> ${escapeHTML(selectedSite.rules)}</div>` : ''}
      `;
  
      document.getElementById('inquiry-site-id').value = selectedSite.id;
      memoOutput.style.display = 'none';
      if (bookingActions) {
        bookingActions.innerHTML = '';
      }
      modal.classList.remove('hidden');
    }
  
    function closeModal() {
      modal.classList.add('hidden');
      selectedSite = null;
    }
  
    modalCloseBtn.addEventListener('click', closeModal);
    modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  
    // 5. 予約メモ・アクション生成（実機テスト対応版）
  btnCreateMemo.addEventListener('click', () => {
    if (!selectedSite) return;
    pushDataLayer('click_memo', { campsite_name: campsiteName(selectedSite) });

    const name = document.getElementById('inquiry-name').value.trim() || '未入力';
    const tel = document.getElementById('inquiry-tel').value.trim() || '未入力';
    const date = document.getElementById('inquiry-date').value || '未定';
    const people = document.getElementById('inquiry-people').value || '2';

    // 施設データの電話番号・URLを柔軟に取得
    // 施設データのプロパティまたは本文テキスト（rules / memo 等）から電話番号を自動抽出
    let siteTel = selectedSite.tel || selectedSite.phone || selectedSite.contact || selectedSite.telephone || selectedSite.contact_tel || '';
    if (!siteTel) {
      const fullText = `${selectedSite.rules || ''} ${selectedSite.specs || ''} ${selectedSite.recommend || ''}`;
      const telMatch = fullText.match(/0\d{1,4}-?\d{1,4}-?\d{3,4}/);
      if (telMatch) {
        siteTel = telMatch[0];
      }
    }

    // 予約・申請URLの抽出（プロパティまたは本文URL）
        let siteUrl = selectedSite.url || selectedSite.officialUrl || selectedSite.website || selectedSite.official_url || selectedSite.homepage || selectedSite.link || '';
    if (!siteUrl) {
      const fullText = `${selectedSite.rules || ''} ${selectedSite.specs || ''}`;
      const urlMatch = fullText.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        siteUrl = urlMatch[0];
      }
    }
    siteUrl = safeNavigationUrl(siteUrl);

    const memo = [
      `【キャンプ場 予約・問い合わせメモ】`,
      `■ 施設名: ${selectedSite.name}`,
      `■ 代表者名: ${name}`,
      `■ 連絡先TEL: ${tel}`,
      `■ 利用予定日: ${date}`,
      `■ 利用人数: ${people}名`,
      `■ 所在地: ${selectedSite.address || ''}`,
      siteTel ? `■ 施設TEL: ${siteTel}` : '',
      `---------------------------------`,
      `※電話予約時は上記の内容を受付にお伝えください。`
    ].filter(Boolean).join('\n');

    memoText.value = memo;
    memoOutput.style.display = 'block';

    if (bookingActions) {
      bookingActions.innerHTML = '';

      // ① 電話発信アクション
      if (siteTel) {
        const cleanTel = siteTel.replace(/[^0-9]/g, '');
        const telLink = document.createElement('a');
        telLink.href = `tel:${cleanTel}`;
        telLink.className = 'btn';
        telLink.style.cssText = 'display: block; background: #166534; color: #ffffff; padding: 12px; font-size: 0.95rem; text-decoration: none; text-align: center; margin-top: 8px; border-radius: 6px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
        telLink.textContent = `📞 施設に直接電話をかける (${siteTel})`;
        telLink.setAttribute('data-gtm-event', 'click_tel');
        telLink.setAttribute('data-campsite-name', campsiteName(selectedSite));
        telLink.setAttribute('data-tel-number', siteTel);
        bookingActions.appendChild(telLink);
      } else {
        const noTelNotice = document.createElement('div');
noTelNotice.style.cssText = 'font-size: 0.85rem; font-weight: bold; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 6px; margin-top: 8px; text-align: center;';
noTelNotice.textContent = '⚠️ ※この施設は電話番号が登録されていないか、現地受付・Web申請専用です。';
bookingActions.appendChild(noTelNotice);
      }

      // ② 公式Web予約・申請ページアクション
      if (siteUrl) {
        const urlLink = document.createElement('a');
        urlLink.href = siteUrl;
        urlLink.target = '_blank';
        urlLink.rel = 'noopener noreferrer';
        urlLink.className = 'btn';
        urlLink.style.cssText = 'display: block; background: #0284c7; color: #ffffff; padding: 12px; font-size: 0.95rem; text-decoration: none; text-align: center; margin-top: 8px; border-radius: 6px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
        urlLink.textContent = '🌐 公式Web予約・申請ページを開く';
        urlLink.setAttribute('data-gtm-event', 'click_official_site');
        urlLink.setAttribute('data-campsite-name', campsiteName(selectedSite));
        urlLink.setAttribute('data-campsite-area', campsiteAreaLabel(selectedSite));
        urlLink.setAttribute('data-link-url', siteUrl);
        bookingActions.appendChild(urlLink);
      }

      // ③ メモ内容のワンタップコピーアクション
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn';
      copyBtn.style.cssText = 'display: block; width: 100%; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; padding: 10px; font-size: 0.88rem; margin-top: 8px; border-radius: 6px; font-weight: bold; cursor: pointer;';
      copyBtn.textContent = '📋 予約メモをコピーする';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(memoText.value).then(() => {
          copyBtn.style.background = '#dcfce7';
          copyBtn.style.borderColor = '#86efac';
          copyBtn.textContent = '✅ コピー完了！そのまま電話・フォームで使用できます';
          setTimeout(() => {
            copyBtn.style.background = '#ffffff';
            copyBtn.style.borderColor = '#cbd5e1';
            copyBtn.textContent = '📋 予約メモをコピーする';
          }, 2500);
        });
      });
      bookingActions.appendChild(copyBtn);

      // メモ表示位置へ自動スクロール
      memoOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
  
    sitesContainer.addEventListener('click', (event) => {
      const keepBtn = event.target.closest('.btn-favorite');
      if (!keepBtn || !sitesContainer.contains(keepBtn)) return;
      const siteId = keepBtn.getAttribute('data-id');
      if (favoriteIds.has(siteId)) {
        favoriteIds.delete(siteId);
      } else {
        favoriteIds.add(siteId);
      }
      saveFavoriteIds();
      if (favoriteIds.size === 0) favoriteOnly = false;
      updateFavoriteBar();
      if (favoriteOnly) {
        applyFilters();
      } else {
        const kept = favoriteIds.has(siteId);
        keepBtn.classList.toggle('is-active', kept);
        keepBtn.title = kept ? 'キープ解除' : 'キープする';
        keepBtn.setAttribute('aria-pressed', kept ? 'true' : 'false');
        keepBtn.setAttribute('aria-label', keepBtn.title);
        keepBtn.textContent = kept ? '❤️' : '🤍';
      }
      const keptSite = allSites.find(s => String(s.id) === String(siteId));
      pushDataLayer('click_keep', { campsite_name: campsiteName(keptSite) });
    });

    btnToggleFavoriteFilter.addEventListener('click', () => {
      favoriteOnly = !favoriteOnly;
      updateFavoriteBar();
      applyFilters();
    });

    btnClearFavorites.addEventListener('click', () => {
      favoriteIds.clear();
      favoriteOnly = false;
      saveFavoriteIds();
      updateFavoriteBar();
      applyFilters();
    });

    function updateFavoriteBar() {
      const count = favoriteIds.size;
      favoriteCountText.textContent = `キープした施設: ${count}件`;
      favoriteBar.classList.toggle('hidden', count === 0);
      btnToggleFavoriteFilter.classList.toggle('is-active', favoriteOnly);
      btnToggleFavoriteFilter.setAttribute('aria-pressed', favoriteOnly ? 'true' : 'false');
      btnToggleFavoriteFilter.textContent = favoriteOnly ? 'すべての施設を表示' : 'キープ中のみ表示';
    }

    function pruneFavorites() {
      const validIds = new Set(allSites.map(site => String(site.id)));
      let changed = false;
      for (const id of favoriteIds) {
        if (!validIds.has(id)) {
          favoriteIds.delete(id);
          changed = true;
        }
      }
      if (changed) saveFavoriteIds();
    }

    function loadFavoriteIds() {
      try {
        const stored = JSON.parse(localStorage.getItem(FAVORITE_STORAGE_KEY) || '[]');
        return new Set(Array.isArray(stored) ? stored.map(String) : []);
      } catch (err) {
        return new Set();
      }
    }

    function saveFavoriteIds() {
      localStorage.setItem(FAVORITE_STORAGE_KEY, JSON.stringify([...favoriteIds]));
    }

    // 6. 検索・フィルターイベント
    cityFilter.addEventListener('change', applyFilters);
    cityFilter.addEventListener('change', () => {
      const option = cityFilter.options[cityFilter.selectedIndex];
      pushDataLayer('filter_area_change', {
        selected_area: option ? option.text.trim() : ''
      });
    });
    searchInput.addEventListener('input', () => {
      if (searchInput.value.length > MAX_KEYWORD_LENGTH) {
        searchInput.value = searchInput.value.slice(0, MAX_KEYWORD_LENGTH);
      }
      applyFilters();
    });
  
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        if (type === 'all') {
          activeFilters.clear();
        } else if (activeFilters.has(type)) {
          activeFilters.delete(type);
        } else {
          activeFilters.add(type);
        }
        syncFilterButtons();
        applyFilters();
        const status = type === 'all' || activeFilters.has(type) ? 'active' : 'inactive';
        pushDataLayer('filter_criteria_click', {
          filter_tag_name: (btn.textContent || '').trim(),
          filter_status: status
        });
      });
    });

    document.querySelectorAll('[data-criteria]').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.getAttribute('data-criteria');
        activeFilters.clear();
        if (type) activeFilters.add(type);
        syncFilterButtons();
        applyFilters();
        const search = document.getElementById('search-section');
        if (search) search.scrollIntoView({ behavior: 'smooth', block: 'start' });
        pushDataLayer('filter_criteria_click', {
          filter_tag_name: filterTagName(type, card),
          filter_status: 'active'
        });
      });
    });

    function syncFilterButtons() {
      filterBtns.forEach(btn => {
        const type = btn.getAttribute('data-type');
        const on = type === 'all' ? activeFilters.size === 0 : activeFilters.has(type);
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
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

    function hasCarAccessAmenity(site) {
      const text = `${planText(site)} ${site.rules || ''}`;
      if (/乗入不可|乗り入れ不可|乗り入れはでき|持込テントエリア|青少年野外|野営場/.test(text)) return false;
      return /オートキャンプ|オートサイト|車横付け|車乗り入れ|車乗入/.test(planText(site));
    }

    function hasFlushToiletAmenity(site) {
      const text = `${facilityText(site)} ${site.specs || ''} ${site.rules || ''}`;
      if (/仮設トイレ|汲み取り|バイオトイレ/.test(text)) return false;
      return /水洗トイレ|ウォシュレット|温水洗浄便座|清潔な洋式トイレ|flush_toilet/.test(text);
    }

    function hasPowerAmenity(site) {
      const text = `${site.specs || ''} ${facilityText(site)} ${site.rules || ''}`;
      if (/電源なし|電源無|電源はなし|AC電源：なし|AC電源:なし/.test(text)) return false;
      return /電源付きサイト|AC電源あり|各サイト電源|1000W/.test(text);
    }

    function hasGrassAmenity(site) {
      const text = `${site.groundType || ''} ${facilityText(site)}`;
      if (/林間|砂利|川原|ウッドデッキ|傾斜|ゴロゴロ/.test(text)) return false;
      return /芝生サイト|芝生・平坦|天然芝|フラットな草地/.test(text);
    }

    const filterMatchers = {
      auto_power(site) {
        return hasPowerAmenity(site);
      },
      auto_standard(site) {
        return hasCarAccessAmenity(site);
      },
      flush_toilet(site) {
        return hasFlushToiletAmenity(site);
      },
      grass(site) {
        return hasGrassAmenity(site);
      },
      cottage(site) {
        return site.type === 'cottage' || /コテージ|ロッジ|バンガロー|宿泊棟/.test(site.name || '');
      },
      waterside(site) {
        const label = `${stripArea(site.name)} ${site.recommend || ''}`;
        return /川代|川の音|能勢川|渓谷|渓流|ダム|湖|池/.test(label);
      },
      highland(site) {
        const name = stripArea(site.name);
        return /高原|森林/.test(name) || (site.recommend || '').includes('高原');
      },
      onsen(site) {
        return /温泉|風呂|入浴/.test(`${stripArea(site.name)} ${site.recommend || ''} ${facilityText(site)} ${site.rules || ''}`);
      },
      budget(site) {
        return /無料|格安|¥0|￥0/.test(String(site.price || ''));
      }
    };
  
    function normalizeSite(site) {
      const ruleText = Array.isArray(site.rules) ? site.rules.join('。') : (site.rules || '');
      const notes = typeof site.notes === 'string' && site.notes ? site.notes : ruleText;
      const telMatch = String(notes).match(/0\d{1,3}-\d{1,4}-\d{3,4}/);
      const areaMatch = String(site.name || '').match(/（([^）]+)）\s*$/);
      const priceLabel = typeof site.price === 'number'
        ? `¥${site.price.toLocaleString('ja-JP')}〜`
        : (site.price || '料金要確認');

      return {
        ...site,
        address: site.address || site.area || (areaMatch ? areaMatch[1] : '兵庫県内'),
        power: Boolean(site.power ?? site.powerAvailable),
        specs: site.specs || site.size || '',
        recommend: site.recommend || site.recommendedFor || '',
        image: site.image || site.imageUrl || '',
        rules: notes,
        price: priceLabel,
        tel: site.tel || (telMatch ? telMatch[0] : ''),
        facilities: Array.isArray(site.facilities) ? site.facilities : []
      };
    }

    function safeNavigationUrl(url) {
      if (typeof url !== 'string' || url.trim() === '') return '';
      try {
        const parsed = new URL(url.trim());
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
      } catch (err) {
        return '';
      }
      return '';
    }

    function escapeHTML(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  
    // 初回ロード実行
    updateFavoriteBar();
    fetchSites();
  });