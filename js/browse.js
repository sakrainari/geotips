let allTips = [];
let viewMode = 'card';

(async () => {
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

function populateFilters() {
  const countries = [...new Set(allTips.map(t => t['国']))].sort();
  const genres    = [...new Set(allTips.flatMap(t => splitGenres(t['ジャンル'])))].sort();

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

function getFiltered() {
  const keyword = document.getElementById('search').value.trim().toLowerCase();
  const country = document.getElementById('filter-country').value;
  const genre   = document.getElementById('filter-genre').value;
  const scope   = document.getElementById('filter-scope').value;
  const sort    = document.getElementById('sort').value;

  let data = allTips.filter(t => t['公開ステータス'] === '公開');

  if (keyword) {
    data = data.filter(t =>
      (t['国'] || '').toLowerCase().includes(keyword) ||
      (t['地域'] || '').toLowerCase().includes(keyword) ||
      (t['メタ知識'] || '').toLowerCase().includes(keyword)
    );
  }
  if (country) data = data.filter(t => t['国'] === country);
  if (genre)   data = data.filter(t => splitGenres(t['ジャンル']).includes(genre));
  if (scope)   data = data.filter(t => t['スコープ'] === scope);

  data.sort((a, b) => {
    if (sort === 'country')  return (a['国'] || '').localeCompare(b['国'] || '', 'ja');
    if (sort === 'date-new') return (b['登録日'] || '').localeCompare(a['登録日'] || '');
    if (sort === 'date-old') return (a['登録日'] || '').localeCompare(b['登録日'] || '');
    if (sort === 'genre')    return (a['ジャンル'] || '').localeCompare(b['ジャンル'] || '', 'ja');
    return 0;
  });

  return data;
}

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

    const sup = tip.supervisor || {};
    const supervisorInfo = sup['名前']
      ? (sup['GeoGuessrレート']
          ? `${sup['名前']} (${sup['GeoGuessrレート']})`
          : `${sup['名前']}（${sup['得意分野'] || ''}）`)
      : '—';

    const imageUrl    = tip['画像URL'] || '';
    const imageCredit = tip['画像クレジット'] || '';
    const country     = tip['国'] || '';
    const region      = tip['地域'] || '';
    const genre       = tip['ジャンル'] || '';
    const scope       = tip['スコープ'] || '';
    const meta        = tip['メタ知識'] || '';
    const supplement  = tip['補足'] || '';
    const svUrl       = tip['参考SVリンク'] || '';

    card.innerHTML = `
      <div class="card-image-wrap">
        ${imageUrl
          ? `<img class="card-image" src="${imageUrl}" alt="tip image" loading="lazy" data-credit="${escHtml(imageCredit)}">`
          : `<div class="card-no-image">NO IMAGE</div>`
        }
        ${imageCredit ? `<span class="image-credit">${escHtml(imageCredit)}</span>` : ''}
      </div>
      <div class="card-body">
        <div class="card-header-row">
          <span class="country-name">${escHtml(country)}</span>
          <span class="badge scope-badge" style="${scopeBadgeStyle(scope)}">${escHtml(scope)}</span>
        </div>
        <div class="region-name">${escHtml(region)}</div>
        ${genreBadgesHtml(genre)}
        <p class="meta-text">${escHtml(meta)}</p>
        ${supplement ? `<p class="supplement-text">${escHtml(supplement)}</p>` : ''}
        <div class="card-footer">
          <span class="supervisor-info">監修: ${escHtml(supervisorInfo)}</span>
          <span class="badge approved-badge">監修済</span>
        </div>
        ${svUrl ? `<a class="sv-btn" href="${svUrl}" target="_blank" rel="noopener">SV で見る</a>` : ''}
      </div>
    `;

    const img = card.querySelector('.card-image');
    if (img) {
      img.addEventListener('click', () => openModal(imageUrl, imageCredit));
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
    const sup         = tip.supervisor || {};
    const imageUrl    = tip['画像URL'] || '';
    const country     = tip['国'] || '';
    const region      = tip['地域'] || '';
    const genre       = tip['ジャンル'] || '';
    const scope       = tip['スコープ'] || '';
    const meta        = tip['メタ知識'] || '';
    const svUrl       = tip['参考SVリンク'] || '';
    const supName     = sup['名前'] || '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-image">
        ${imageUrl
          ? `<img class="table-thumb" src="${imageUrl}" alt="" loading="lazy">`
          : `<div class="table-no-image">-</div>`
        }
      </td>
      <td>${escHtml(country)}</td>
      <td>${escHtml(region)}</td>
      <td>${genreBadgesHtml(genre)}</td>
      <td><span class="badge scope-badge" style="${scopeBadgeStyle(scope)}">${escHtml(scope)}</span></td>
      <td class="td-meta">${escHtml(meta)}</td>
      <td>${escHtml(supName)}</td>
      <td>${svUrl ? `<a class="sv-link" href="${svUrl}" target="_blank" rel="noopener">SV</a>` : '—'}</td>
    `;

    const img = tr.querySelector('.table-thumb');
    if (img) {
      img.addEventListener('click', () => openModal(imageUrl, tip['画像クレジット'] || ''));
    }

    tbody.appendChild(tr);
  });

  container.appendChild(table);
}

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

['search', 'filter-country', 'filter-genre', 'filter-scope', 'sort'].forEach(id => {
  document.getElementById(id).addEventListener('input', render);
  document.getElementById(id).addEventListener('change', render);
});

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
