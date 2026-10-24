document.addEventListener('DOMContentLoaded', function () {
    let allSites = [];
    let currentType = 'all';
  
    const sitesContainer = document.getElementById('sites-container');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const cityFilter = document.getElementById('city-filter');
    const searchInput = document.getElementById('search-input');
    const resultCounter = document.getElementById('result-counter');
  
    // 初期データ取得
    fetch('/api/sites')
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTPエラー: ' + res.status);
        }
        return res.json();
      })
      .then(function (response) {
        if (response && Array.isArray(response.data)) {
          allSites = response.data;
        } else if (Array.isArray(response)) {
          allSites = response;
        } else {
          allSites = [];
        }
        applyFilters();
      })
      .catch(function (err) {
        console.error('データ取得失敗:', err);
        sitesContainer.innerHTML = '<p>データの読み込みに失敗しました。</p>';
      });
  
    // フィルタリング処理
    function applyFilters() {
      const selectedCity = cityFilter ? cityFilter.value.trim() : '';
      const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
      const filtered = allSites.filter(function (site) {
        const matchType = (currentType === 'all') || (site.type === currentType);
  
        const matchCity = !selectedCity ||
          site.name.indexOf(selectedCity) !== -1 ||
          (site.recommendedFor && site.recommendedFor.indexOf(selectedCity) !== -1) ||
          (site.notes && site.notes.indexOf(selectedCity) !== -1);
  
        const targetText = [
          site.name,
          site.recommendedFor || '',
          (site.facilities || []).join(' '),
          site.notes || ''
        ].join(' ').toLowerCase();
  
        const matchKeyword = !keyword || targetText.indexOf(keyword) !== -1;
  
        return matchType && matchCity && matchKeyword;
      });
  
      // 件数バッジの更新
      if (resultCounter) {
        resultCounter.textContent = '該当件数: ' + filtered.length + '件 / 全' + allSites.length + '件';
      }
  
      renderSites(filtered);
    }
  
    if (cityFilter) {
      cityFilter.addEventListener('change', applyFilters);
    }
  
    if (searchInput) {
      searchInput.addEventListener('input', applyFilters);
    }
  
    filterButtons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        filterButtons.forEach(function (b) { b.classList.remove('active'); });
        e.target.classList.add('active');
        currentType = e.target.dataset.type;
        applyFilters();
      });
    });
  
    // 施設カード描画
    function renderSites(sites) {
      if (!sites || sites.length === 0) {
        sitesContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b; font-weight: bold;">該当するキャンプ場が見つかりませんでした。</div>';
        return;
      }
  
      let html = '';
      sites.forEach(function (site) {
        const imgUrl = site.imageUrl || 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80';
        const capText = site.capacity ? (site.capacity.min + '〜' + site.capacity.max + '名') : '2〜6名';
        const priceText = (site.price === 0) ? '無料 (¥0)' : ('¥' + (site.price || 0).toLocaleString());
  
        let facilitiesHtml = '';
        if (Array.isArray(site.facilities)) {
          site.facilities.forEach(function (f) {
            facilitiesHtml += '<span class="facility-tag">' + escapeText(f) + '</span>';
          });
        }
  
        html += '<div class="site-card">';
        html += '  <div class="site-card-image">';
        html += '    <img src="' + imgUrl + '" alt="' + escapeText(site.name) + '" loading="lazy">';
        html += '  </div>';
        html += '  <div class="site-card-body">';
        html += '    <h4>' + escapeText(site.name) + '</h4>';
        html += '    <div class="site-recommend">' + escapeText(site.recommendedFor || '') + '</div>';
        html += '    <ul class="site-specs">';
        html += '      <li>📐 広さ: ' + escapeText(site.size || '区画・フリー共用') + '</li>';
        html += '      <li>👥 定員: ' + capText + '</li>';
        html += '      <li>⚡ AC電源: ' + (site.powerAvailable ? 'あり (100V)' : 'なし') + '</li>';
        html += '      <li>🌿 地面: ' + escapeText(site.groundType || '芝生・土') + '</li>';
        html += '    </ul>';
        html += '    <div class="site-facilities">' + facilitiesHtml + '</div>';
        
        if (site.notes) {
          html += '    <div class="site-notes-box" style="margin: 10px 0; padding: 8px 10px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; font-size: 0.78rem; color: #92400e; line-height: 1.4;">';
          html += '      📌 <strong>利用・申請ルール:</strong> ' + escapeText(site.notes);
          html += '    </div>';
        }
  
        html += '    <div class="site-card-footer">';
        html += '      <div class="price">' + priceText + '<span style="font-size: 0.75rem; color: #64748b;"> / 泊</span></div>';
        html += '      <button class="btn btn-open-modal" data-id="' + site.id + '">';
        html += '        詳細・予約メモ';
        html += '      </button>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
      });
  
      sitesContainer.innerHTML = html;
  
      document.querySelectorAll('.btn-open-modal').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          const siteId = e.currentTarget.dataset.id;
          const target = allSites.find(function (s) { return s.id === siteId; });
          if (target) {
            openModal(target);
          }
        });
      });
    }
  
    // モーダル制御
    const modal = document.getElementById('booking-modal') || document.getElementById('inquiry-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalDetails = document.getElementById('modal-site-details');
    const memoOutput = document.getElementById('memo-output');
    const memoText = document.getElementById('memo-text');
    const btnCreateMemo = document.getElementById('btn-create-memo');
  
    let currentSelectedSite = null;
  
    function openModal(site) {
      if (!modal) return;
      currentSelectedSite = site;
  
      const siteIdInput = document.getElementById('inquiry-site-id');
      const targetSiteName = document.getElementById('target-site-name');
      if (siteIdInput) siteIdInput.value = site.id;
      if (targetSiteName) targetSiteName.textContent = site.name;
  
      if (modalDetails) {
        const priceStr = (site.price === 0) ? '完全無料（¥0）' : ('¥' + (site.price || 0).toLocaleString() + ' / 泊');
        const facilitiesList = Array.isArray(site.facilities) ? site.facilities.join(' / ') : '標準設備';
  
        let detailsHtml = '';
        detailsHtml += '<div style="margin-bottom: 6px;"><strong>💴 利用料金:</strong> ' + escapeText(priceStr) + '</div>';
        detailsHtml += '<div style="margin-bottom: 6px;"><strong>📐 サイト形態:</strong> ' + escapeText(site.size || '区画・フリー共用') + '（地面: ' + escapeText(site.groundType || '土') + '）</div>';
        detailsHtml += '<div style="margin-bottom: 6px;"><strong>🔌 AC電源:</strong> ' + (site.powerAvailable ? 'あり (100V)' : 'なし') + '</div>';
        detailsHtml += '<div style="margin-bottom: 6px;"><strong>🚻 主な設備:</strong> ' + escapeText(facilitiesList) + '</div>';
        
        if (site.notes) {
          detailsHtml += '<div style="margin-top: 10px; padding: 8px 10px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; color: #92400e;">';
          detailsHtml += '  <strong>⚠️ 利用ルール・注意事項:</strong><br>' + escapeText(site.notes);
          detailsHtml += '</div>';
        }
        
        modalDetails.innerHTML = detailsHtml;
      }
  
      if (memoOutput) memoOutput.style.display = 'none';
  
      modal.classList.remove('hidden');
      modal.classList.add('active');
    }
  
    if (btnCreateMemo) {
      btnCreateMemo.addEventListener('click', function () {
        const name = (document.getElementById('inquiry-name').value || '未入力').trim();
        const tel = (document.getElementById('inquiry-tel').value || '未入力').trim();
        const date = document.getElementById('inquiry-date').value || '未定';
        const people = document.getElementById('inquiry-people').value || '1';
  
        if (!currentSelectedSite) return;
  
        const noteText = [
          '【キャンプ場 予約・問い合わせメモ】',
          '■ 施設名: ' + currentSelectedSite.name,
          '■ 代表者名: ' + name,
          '■ 連絡先TEL: ' + tel,
          '■ 利用希望日: ' + date,
          '■ 利用人数: ' + people + '名',
          '■ 確認事項/ルール: ' + (currentSelectedSite.notes || '特になし'),
          '-----------------------------------',
          'お電話または公式申請フォームにて上記内容をお伝えください。'
        ].join('\n');
  
        if (memoText && memoOutput) {
          memoText.value = noteText;
          memoOutput.style.display = 'block';
        }
      });
    }
  
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', function () {
        modal.classList.add('hidden');
        modal.classList.remove('active');
      });
    }
  
    window.addEventListener('click', function (e) {
      if (e.target === modal) {
        modal.classList.add('hidden');
        modal.classList.remove('active');
      }
    });
  
    function escapeText(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  });