document.addEventListener('DOMContentLoaded', () => {
    let allSites = [];
    const activeFilters = new Set();
  
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
  
    let selectedSite = null;
  
    // 1. データ取得（配列直接・オブジェクト内包のどちらの形式でも安全に展開）
    async function fetchSites() {
      try {
        const res = await fetch('/api/sites');
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
  
        let rawSites = [];
        if (Array.isArray(data)) {
          rawSites = data;
        } else if (Array.isArray(data.sites)) {
          rawSites = data.sites;
        } else if (Array.isArray(data.data)) {
          rawSites = data.data;
        }
        allSites = rawSites.map(normalizeSite);
  
        applyFilters();
      } catch (err) {
        console.error('Fetch error:', err);
        sitesContainer.innerHTML = '<p style="color: #dc2626; text-align: center; padding: 24px;">データの読み込みに失敗しました。server.js が起動しているか確認してください。</p>';
      }
    }
  
    // 2. フィルタリングと描画
    function applyFilters() {
      const selectedCity = cityFilter.value.trim();
      const keyword = searchInput.value.trim().toLowerCase();
  
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
        // キーワード検索
        if (keyword) {
          const facilities = Array.isArray(site.facilities) ? site.facilities.join(' ') : '';
          const targetString = `${name} ${address} ${site.recommend || ''} ${site.specs || ''} ${facilities}`.toLowerCase();
          if (!targetString.includes(keyword)) return false;
        }
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

  function getSiteImage(site, index) {
    if (site.image && site.image.trim() !== '') return site.image;
    const name = site.name || '';
    if (name.includes('コテージ') || name.includes('村')) return campImages[5];
    if (name.includes('高原') || name.includes('山')) return campImages[3];
    if (name.includes('川') || name.includes('渓流') || name.includes('湖')) return campImages[6];
    if (name.includes('公園') || name.includes('広場')) return campImages[7];
    return campImages[index % campImages.length];
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

      return `
        <article class="site-card">
          <div class="site-card-image">
            <img src="${imageUrl}" alt="${escapeHTML(site.name)}" loading="lazy">
          </div>
          <div class="site-card-body">
            <h4>${escapeHTML(site.name)}</h4>
            <div class="site-recommend">${escapeHTML(site.recommend || 'おすすめファミリーサイト')}</div>
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
              <button type="button" class="btn btn-open-modal" data-id="${site.id}">詳細・予約メモ</button>
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
        <p style="margin: 0 0 6px 0;"><strong>設備:</strong> ${(selectedSite.facilities || []).join('、') || '特になし'}</p>
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
    let siteUrl = selectedSite.url || selectedSite.website || selectedSite.official_url || selectedSite.homepage || selectedSite.link || '';
    if (!siteUrl) {
      const fullText = `${selectedSite.rules || ''} ${selectedSite.specs || ''}`;
      const urlMatch = fullText.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        siteUrl = urlMatch[0];
      }
    }

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
  
    // 6. 検索・フィルターイベント
    cityFilter.addEventListener('change', applyFilters);
    searchInput.addEventListener('input', applyFilters);
  
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

    const filterMatchers = {
      auto_power(site) {
        return Boolean(site.power)
          || (site.specs && site.specs.includes('電源'))
          || (site.recommend && site.recommend.includes('電源'));
      },
      auto_standard(site) {
        const text = `${site.name || ''} ${site.specs || ''} ${site.rules || ''}`;
        if (/乗入不可|乗り入れはでき/.test(text)) return false;
        return site.type === 'auto_standard' || (site.specs && site.specs.includes('区画'));
      },
      cottage(site) {
        return site.type === 'cottage' || (site.name && site.name.includes('コテージ'));
      },
      waterside(site) {
        const label = `${stripArea(site.name)} ${site.recommend || ''}`;
        return /川代|川の音|能勢川|渓谷|渓流|ダム|湖|池/.test(label);
      },
      sea(site) {
        const label = `${stripArea(site.name)} ${site.recommend || ''}`;
        return /海|ビーチ|海岸|海水浴|潮干/.test(label);
      },
      highland(site) {
        return stripArea(site.name).includes('高原') || (site.recommend || '').includes('高原');
      },
      onsen(site) {
        return `${stripArea(site.name)} ${site.recommend || ''}`.includes('温泉');
      },
      budget(site) {
        return /無料|格安|¥0|￥0/.test(String(site.price || ''));
      },
      glamping(site) {
        return `${site.name || ''} ${site.recommend || ''}`.includes('グランピング');
      }
    };
  
    function normalizeSite(site) {
      const notes = site.notes || site.rules || '';
      const telMatch = notes.match(/0\d{1,3}-\d{1,4}-\d{3,4}/);
      const areaMatch = String(site.name || '').match(/（([^）]+)）\s*$/);
      const priceLabel = typeof site.price === 'number'
        ? `¥${site.price.toLocaleString('ja-JP')}〜`
        : (site.price || '料金要確認');

      return {
        ...site,
        address: site.address || (areaMatch ? areaMatch[1] : '兵庫県内'),
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
    fetchSites();
  });