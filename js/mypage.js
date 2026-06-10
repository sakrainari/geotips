// ===========================
// 1. 状態管理
// ===========================
let myName    = '';
let myPosts   = [];
let genres    = [];
let editItem  = null;

// ===========================
// 2. 初期化
// ===========================
document.addEventListener('DOMContentLoaded', async () => {
  // ジャンルをGASから取得（select動的生成用）
  try {
    genres = await fetchGenres();
    updateGenreStylesFromData(genres);
  } catch (e) {
    if (typeof DEFAULT_GENRES !== 'undefined') genres = DEFAULT_GENRES;
  }
  populateEditGenreSelect();
});

// ===========================
// 3. 名前入力
// ===========================
document.getElementById('name-submit').addEventListener('click', handleNameSubmit);
document.getElementById('name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleNameSubmit();
});

async function handleNameSubmit() {
  const name  = document.getElementById('name-input').value.trim();
  const errEl = document.getElementById('name-error');
  const btn   = document.getElementById('name-submit');

  if (!name) {
    errEl.textContent = '投稿者名を入力してください';
    errEl.classList.add('visible');
    return;
  }

  errEl.classList.remove('visible');
  btn.textContent = '確認中...';
  btn.disabled    = true;

  try {
    myName  = name;
    myPosts = await fetchMyData(name);

    document.getElementById('name-section').classList.add('hidden');
    document.getElementById('mypage-section').classList.remove('hidden');
    document.getElementById('mypage-username').textContent = name;
    renderTable();
  } catch (e) {
    errEl.textContent = 'エラー: ' + e.message;
    errEl.classList.add('visible');
  } finally {
    btn.textContent = '確認する';
    btn.disabled    = false;
  }
}

// ===========================
// 4. 投稿一覧
// ===========================
function renderTable() {
  const wrap = document.getElementById('mypage-table-wrap');
  document.getElementById('mypage-count').textContent = `${myPosts.length}件`;

  if (!myPosts.length) {
    wrap.innerHTML = '<p class="empty-text">投稿がありません</p>';
    return;
  }

  const rows = myPosts.map(item => {
    const canEdit = item.公開ステータス !== '公開';
    const editBtn = canEdit
      ? `<button class="btn btn-sm btn-edit" onclick="openEditModal('${escHtml(item.id)}')">編集</button>`
      : '';
    const returnReason = item.公開ステータス === '差し戻し' && item.備考
      ? escHtml(item.備考)
      : '—';

    return `
      <tr>
        <td>${escHtml(item.登録日 || '')}</td>
        <td>${escHtml(item.国 || '')}</td>
        <td>${escHtml(item.地域 || '')}</td>
        <td>${escHtml(item.ジャンル || '')}</td>
        <td>${escHtml(item.スコープ || '')}</td>
        <td class="td-meta-short">${escHtml((item.メタ知識 || '').slice(0, 40))}${(item.メタ知識 || '').length > 40 ? '…' : ''}</td>
        <td>${statusBadgeHtml(item.公開ステータス)}</td>
        <td class="td-reason-short">${returnReason}</td>
        <td>${editBtn}</td>
      </tr>
    `;
  }).join('');

  wrap.innerHTML = `
    <div class="mypage-table-wrap">
      <table class="mypage-table">
        <thead><tr>
          <th>登録日</th><th>国</th><th>地域</th><th>ジャンル</th>
          <th>スコープ</th><th>メタ知識</th><th>ステータス</th><th>差し戻し理由</th><th>操作</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ===========================
// 5. 編集モーダル
// ===========================
function openEditModal(id) {
  const item = myPosts.find(p => p.id === id);
  if (!item) return;
  editItem = item;

  document.getElementById('edit-id').textContent   = '#' + item.id;
  document.getElementById('edit-status').innerHTML = statusBadgeHtml(item.公開ステータス);

  document.getElementById('edit-country').value        = item.国 || '';
  document.getElementById('edit-region').value         = item.地域 || '';
  document.getElementById('edit-scope').value          = item.スコープ || '';
  document.getElementById('edit-meta').value           = item.メタ知識 || '';
  document.getElementById('edit-supplement').value     = item.補足 || '';
  document.getElementById('edit-sv-url').value         = item.参考SVリンク || '';
  document.getElementById('edit-ref-url').value        = item.参考サイト || '';
  document.getElementById('edit-image-url').value      = item.画像URL || '';
  document.getElementById('edit-image-credit').value   = item.画像クレジット || '';
  document.getElementById('edit-memo').value           = item.監修者へのメモ || '';
  document.getElementById('edit-return-reason-display').textContent = item.備考 || '（なし）';
  document.getElementById('edit-return-reason-wrap').classList.toggle('hidden', !item.備考);

  // ジャンル選択を現在値にセット
  populateEditGenreSelect(item.ジャンル);
  updateEditImagePreview(item.画像URL || '');
  updateResubmitButtonLabel(item.公開ステータス);

  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  editItem = null;
}

document.getElementById('edit-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditModal();
});

// ===========================
// 6. 画像プレビュー
// ===========================
document.getElementById('edit-image-url').addEventListener('input', function () {
  updateEditImagePreview(this.value.trim());
});

function updateEditImagePreview(url) {
  const img = document.getElementById('edit-image-preview');
  const err = document.getElementById('edit-image-error');
  if (!url) { img.classList.remove('visible'); err.classList.remove('visible'); return; }
  img.src = url;
  img.classList.add('visible');
  img.onerror = () => { img.classList.remove('visible'); err.classList.add('visible'); };
  img.onload  = () => { err.classList.remove('visible'); };
}

function updateResubmitButtonLabel(status) {
  const btn = document.getElementById('btn-resubmit');
  btn.textContent = status === '差し戻し' ? '修正して再送信' : '更新して再送信';
}

// ===========================
// 7. 修正して再送信
// ===========================
document.getElementById('btn-resubmit').addEventListener('click', async () => {
  if (!editItem) return;
  const currentItem = editItem;
  const successMessage = currentItem.公開ステータス === '差し戻し'
    ? '修正して再送信しました'
    : '更新して再送信しました';

  const fields = {
    国:             document.getElementById('edit-country').value.trim(),
    地域:           document.getElementById('edit-region').value.trim(),
    スコープ:       document.getElementById('edit-scope').value,
    ジャンル:       joinGenres(getSelectedGenres(document.getElementById('edit-genre'))),
    メタ知識:       document.getElementById('edit-meta').value.trim(),
    補足:           document.getElementById('edit-supplement').value.trim(),
    参考SVリンク:   document.getElementById('edit-sv-url').value.trim(),
    参考サイト:     document.getElementById('edit-ref-url').value.trim(),
    画像URL:        document.getElementById('edit-image-url').value.trim(),
    画像クレジット: document.getElementById('edit-image-credit').value.trim(),
    監修者へのメモ: document.getElementById('edit-memo').value.trim(),
  };

  const btn = document.getElementById('btn-resubmit');
  btn.textContent = '送信中...';
  btn.disabled    = true;

  try {
    await updateMyData(myName, currentItem.id, fields);
    showToast(successMessage);

    // ローカルのデータも更新して再描画
    const idx = myPosts.findIndex(p => p.id === currentItem.id);
    if (idx !== -1) myPosts[idx] = { ...myPosts[idx], ...fields, 公開ステータス: '監修待ち' };
    closeEditModal();
    renderTable();
  } catch (e) {
    alert('エラー: ' + e.message);
  } finally {
    updateResubmitButtonLabel(currentItem.公開ステータス);
    btn.disabled    = false;
  }
});

document.getElementById('btn-cancel').addEventListener('click', closeEditModal);

// ===========================
// 8. ユーティリティ
// ===========================
const STATUS_STYLES = {
  '監修待ち':   'background:#F59E0B;color:#1C1917;',
  '差し戻し':   'background:#DC2626;color:#fff;',
  '公開':       'background:#16A34A;color:#fff;',
  '再確認待ち': 'background:#7C3AED;color:#fff;',
  '非公開':     'background:#64748B;color:#fff;',
};

function statusBadgeHtml(status) {
  const style = STATUS_STYLES[status] || 'background:#64748B;color:#fff;';
  return `<span class="status-badge" style="${style}">${escHtml(status || '不明')}</span>`;
}

function populateEditGenreSelect(selectedValue) {
  const sel = document.getElementById('edit-genre');
  if (!sel) return;
  // 複数ジャンル対応
  const currentSet = new Set(splitGenres(selectedValue != null ? selectedValue : getSelectedGenres(sel)));
  sel.innerHTML = '';
  genres.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.ジャンル名;
    opt.textContent = g.ジャンル名;
    if (currentSet.has(g.ジャンル名)) opt.selected = true;
    sel.appendChild(opt);
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
