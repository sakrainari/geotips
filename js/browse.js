let allTips = [];
let viewMode = 'card'; // 'card' | 'table'

// --- 初期化 ---
(async () => {
  // ジャンルスタイルをGASから更新（失敗してもデフォルトで続行）
  try {
    const genres = await fetchGenres();
    updateGenreStylesFromData(genres);
  } catch (e) {
    console.warn('ジャンル情報の取得に失敗（デフォルトを使用）:', e.message);
  }
  allTips = await fetchTips();
  populateFilters();
  render();
})();

// --- フィルター選択肢を動的生成 ---
function populateFilters() {
  const countries = [...new Set(allTips.map(t => t.country))].sort();
  const genres    = [...new Set(allTips.map(t => t.genre))].sort();

  const countryEl = document.getElementById('filter-country');
  const genreEl   = document.getElementById('filter-genre');

  countries.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    countryEl.appendChild(o);
  });
  genres.forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = g;
    genreEl.appendChild(o);
  });
}

// --- フィルター・ソート適用後のデータ取得 ---
function getFiltered() {
  const keyword = document.getElementById('search').value.trim().toLowerCase();
  const country = document.getElementById('filter-country').value;
  const genre   = document.getElementById('filter-genre').value;
  const scope   = document.getElementById('filter-scope').value;
  const sort    = document.getElementById('sort').value;

  let data = allTips.filter(t => t.status === '公開');

  if (keyword) {
    data = data.filter(t =>
      t.country.toLowerCase().includes(keyword) ||
      t.region.toLowerCase().includes(keyword) ||
      t.meta.toLowerCase().includes(keyword)
    );
  }
  if (country) data = data.filter(t => t.country === country);
  if (genre)   data = data.filter(t => t.genre === genre);
  if (scope)   data = data.filter(t => t.scope === scope);

  data.sort((a, b) => {
    if (sort === 'country')  return a.country.localeCompare(b.country, 'ja');
    if (sort === 'date-new') return b.registered_at.localeCompare(a.registered_at);
    if (sort === 'date-old') return a.registered_at.localeCompare(b.registered_at);
    if (sort === 'genre')    return a.genre.localeCompare(b.genre, 'ja');
    return 0;
  });

  return data;
}

// --- 描画 ---
function render() {
  const data = getFiltered();
  document.getElementById('count').textContent = `${data.length}件表示中`;

  if (viewMode === 'card') {
    renderCards(data);
  } else {
    renderTable(data);
  }
}

function renderCards(data) {
  const container = document.getElementById('main-content');
  container.innerHTML = '';
  container.className = 'card-grid';

  data.forEach(tip => {
    const card = document.createElement('div');
    card.className = 'card';

    const supervisorInfo = tip.supervisor_rate
      ? `${tip.supervisor_name} (${tip.supervisor_rate})`
      : `${tip.supervisor_name}（${tip.supervisor_specialty}）`;

    card.innerHTML = `
      <div class="card-image-wrap">
        ${tip.image_url
          ? `<img class="card-image" src="${tip.image_url}" alt="tip image" loading="lazy" data-credit="${escHtml(tip.image_credit)}">`
          : `<div class="card-no-image">NO IMAGE</div>`
        }
        ${tip.image_credit ? `<span class="image-credit">${escHtml(tip.image_credit)}</span>` : ''}
      </div>
      <div class="card-body">
        <div class="card-header-row">
          <span class="country-name">${tip.flag} ${escHtml(tip.country)}</span>
          <span class="badge scope-badge" style="${scopeBadgeStyle(tip.scope)}">${tip.scope}</span>
        </div>
        <div class="region-name">${escHtml(tip.region)}</div>
        <span class="badge genre-badge" style="${genreBadgeStyle(tip.genre)}">${escHtml(tip.genre)}</span>
        <p class="meta-text">${escHtml(tip.meta)}</p>
        ${tip.supplement ? `<p class="supplement-text">${escHtml(tip.supplement)}</p>` : ''}
        <div class="card-footer">
          <span class="supervisor-info">監修: ${escHtml(supervisorInfo)}</span>
          <span class="badge approved-badge">監修済</span>
        </div>
        <a class="sv-btn" href="${tip.sv_url}" target="_blank" rel="noopener">SV で見る</a>
      </div>
    `;

    // 画像クリックでモーダル
    const img = card.querySelector('.card-image');
    if (img) {
      img.addEventListener('click', () => openModal(tip.image_url, tip.image_credit));
    }

    container.appendChild(card);
  });
}

function renderTable(data) {
  const container = document.getElementById('main-content');
  container.innerHTML = '';
  container.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'tips-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>画像</th>
        <th>国</th>
        <th>地域</th>
        <th>ジャンル</th>
        <th>スコープ</th>
        <th>メタ知識</th>
        <th>監修者</th>
        <th>SV</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  data.forEach(tip => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-image">
        ${tip.image_url
          ? `<img class="table-thumb" src="${tip.image_url}" alt="" loading="lazy">`
          : `<div class="table-no-image">-</div>`
        }
      </td>
      <td title="${escHtml(tip.country)}">${tip.flag}</td>
      <td>${escHtml(tip.region)}</td>
      <td><span class="badge genre-badge" style="${genreBadgeStyle(tip.genre)}">${escHtml(tip.genre)}</span></td>
      <td><span class="badge scope-badge" style="${scopeBadgeStyle(tip.scope)}">${tip.scope}</span></td>
      <td class="td-meta">${escHtml(tip.meta)}</td>
      <td>${escHtml(tip.supervisor_name)}</td>
      <td><a class="sv-link" href="${tip.sv_url}" target="_blank" rel="noopener">SV</a></td>
    `;

    const img = tr.querySelector('.table-thumb');
    if (img) {
      img.addEventListener('click', () => openModal(tip.image_url, tip.image_credit));
    }

    tbody.appendChild(tr);
  });

  container.appendChild(table);
}

// --- モーダル ---
function openModal(url, credit) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-img').src = url;
  document.getElementById('modal-credit').textContent = credit || '';
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

document.getElementById('modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// --- 表示切替 ---
document.getElementById('btn-card').addEventListener('click', () => {
  viewMode = 'card';
  document.getElementById('btn-card').classList.add('active');
  document.getElementById('btn-table').classList.remove('active');
  render();
});

document.getElementById('btn-table').addEventListener('click', () => {
  viewMode = 'table';
  document.getElementById('btn-table').classList.add('active');
  document.getElementById('btn-card').classList.remove('active');
  render();
});

// --- フィルター・ソートのイベント ---
['search', 'filter-country', 'filter-genre', 'filter-scope', 'sort'].forEach(id => {
  document.getElementById(id).addEventListener('input', render);
  document.getElementById(id).addEventListener('change', render);
});

// --- XSS対策: HTML特殊文字をエスケープ ---
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
