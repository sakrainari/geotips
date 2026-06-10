// ===========================
// 1. 状態管理
// ===========================
const state = {
  token:       null,
  mode:        null,  // 'supervisor' | 'admin'
  pending:     [],
  approvedData: [],
  allData:     [],
  supervisors: [],
  genres:      [],
  pendingView: 'before',  // 'before' | 'done'
  currentEdit:       null,
  currentSupEdit:    null,
  currentGenreEdit:  null,
};

// ===========================
// 2. 初期化
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  // config.jsからトークンがあればプリフィル
  const preToken =
    (typeof ADMIN_TOKEN      !== 'undefined') ? ADMIN_TOKEN :
    (typeof SUPERVISOR_TOKEN !== 'undefined') ? SUPERVISOR_TOKEN : '';
  if (preToken) document.getElementById('token-input').value = preToken;
});

document.getElementById('token-submit').addEventListener('click', handleTokenSubmit);
document.getElementById('token-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleTokenSubmit();
});

async function handleTokenSubmit() {
  const token = document.getElementById('token-input').value.trim();
  if (!token) return;

  const btn   = document.getElementById('token-submit');
  const errEl = document.getElementById('token-error');
  btn.textContent = '確認中...';
  btn.disabled    = true;
  errEl.classList.remove('visible');

  try {
    const mode = await detectMode(token);
    if (!mode) {
      errEl.textContent = 'トークンが正しくありません';
      errEl.classList.add('visible');
      return;
    }
    state.token = token;
    state.mode  = mode;
    sessionStorage.setItem('admin_token', token);
    sessionStorage.setItem('admin_mode',  mode);

    document.getElementById('token-modal').classList.add('hidden');
    setupUI();
    await loadInitialData();

  } catch (e) {
    errEl.textContent = 'エラー: ' + e.message;
    errEl.classList.add('visible');
  } finally {
    btn.textContent = '確認する';
    btn.disabled    = false;
  }
}

// トークン種別を判定（admin > supervisor > null）
async function detectMode(token) {
  try {
    await fetchAllData(token);
    return 'admin';
  } catch (e) {
    if (e.message !== 'Unauthorized') throw e;
  }
  try {
    await fetchPendingData(token);
    return 'supervisor';
  } catch (e) {
    if (e.message === 'Unauthorized') return null;
    throw e;
  }
}

// ===========================
// 3. UIセットアップ
// ===========================
function setupUI() {
  // モードバッジ
  const badge = document.getElementById('mode-badge');
  badge.textContent = state.mode === 'admin' ? '管理者' : '監修者';
  badge.className   = 'mode-badge ' + state.mode;
  badge.classList.remove('hidden');

  // 管理者専用タブを表示
  if (state.mode === 'admin') {
    document.querySelectorAll('.tab-admin-only').forEach(el => el.classList.remove('hidden'));
  }

  // タブナビを表示してイベント設定
  document.getElementById('tab-nav').classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

// ===========================
// 4. タブ管理
// ===========================
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));

  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
  const panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.remove('hidden');

  // タブ4は全データから動的生成
  if (tabId === 'registrants') renderRegistrantTable();
  // タブ5
  if (tabId === 'genres') loadGenres();
}

// ===========================
// 5. 初期データ読み込み
// ===========================
async function loadInitialData() {
  // ジャンルを先に取得（編集モーダルのドロップダウンに使う）
  try {
    state.genres = await fetchGenres();
    updateGenreStylesFromData(state.genres);
    populateGenreDropdown('edit-genre');
  } catch (e) {
    console.warn('ジャンル取得失敗（デフォルトを使用）:', e.message);
    if (typeof DEFAULT_GENRES !== 'undefined') {
      state.genres = DEFAULT_GENRES;
      populateGenreDropdown('edit-genre');
    }
  }

  // 監修者マスターを先に取得（承認モーダルのドロップダウンに使う）
  try {
    state.supervisors = await fetchSupervisors(state.token);
    populateSupervisorDropdown();
  } catch (e) {
    console.warn('監修者マスター取得失敗:', e);
  }

  await loadPending();
  loadApproved(); // バックグラウンドで取得

  if (state.mode === 'admin') {
    loadAllData();     // バックグラウンドで取得
    loadSupervisors(); // タブ3用
  }

  switchTab('pending');
}

// ===========================
// 6. タブ1：監修待ち一覧
// ===========================
async function loadPending() {
  const wrap = document.getElementById('pending-table-wrap');
  wrap.innerHTML = '<p class="loading-text">読み込み中...</p>';
  try {
    state.pending = await fetchPendingData(state.token);
    renderCurrentSubTab();
  } catch (e) {
    wrap.innerHTML = `<p class="error-text">読み込みエラー: ${escHtml(e.message)}</p>`;
  }
}

async function loadApproved() {
  try {
    state.approvedData = await fetchPublicData();
    if (state.pendingView === 'done') renderApprovedTable();
  } catch (e) {
    console.warn('監修済データ取得失敗:', e.message);
  }
}

function reloadPendingTab() {
  if (state.pendingView === 'before') loadPending();
  else loadApproved().then(() => renderApprovedTable());
}

function renderCurrentSubTab() {
  if (state.pendingView === 'before') renderPendingTable();
  else renderApprovedTable();
}

// サブタブ切替
document.querySelectorAll('.sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.pendingView = btn.dataset.sub;
    renderCurrentSubTab();
  });
});

function renderPendingTable() {
  const wrap = document.getElementById('pending-table-wrap');
  if (!state.pending.length) {
    wrap.innerHTML = '<p class="empty-text">監修待ちデータはありません</p>';
    return;
  }

  const rows = state.pending.map(item => `
    <tr>
      <td>${escHtml(item.id)}</td>
      <td>${escHtml(item.投稿者名 || '')}</td>
      <td>${escHtml(item.国 || '')}</td>
      <td>${escHtml(item.地域 || '')}</td>
      <td>${escHtml(item.ジャンル || '')}</td>
      <td>${escHtml(item.スコープ || '')}</td>
      <td class="td-meta-short">${escHtml((item.メタ知識 || '').slice(0, 40))}${(item.メタ知識 || '').length > 40 ? '…' : ''}</td>
      <td>${escHtml(item.登録日 || '')}</td>
      <td>${statusBadgeHtml(item.公開ステータス)}</td>
      <td class="td-actions">
        <button class="btn btn-sm btn-primary" onclick="openEditModal('pending','${escHtml(item.id)}')">監修する</button>
      </td>
    </tr>
  `).join('');

  wrap.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr>
      <th>ID</th><th>投稿者名</th><th>国</th><th>地域</th>
      <th>ジャンル</th><th>スコープ</th><th>メタ知識</th>
      <th>登録日</th><th>ステータス</th><th>操作</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderApprovedTable() {
  const wrap = document.getElementById('pending-table-wrap');
  if (!state.approvedData.length) {
    wrap.innerHTML = '<p class="empty-text">監修済データがありません（読み込み中の場合はしばらくお待ちください）</p>';
    return;
  }

  const rows = state.approvedData.map(item => {
    const sup = item.supervisor || {};
    const supName = sup['名前'] || item.監修者名 || '—';
    return `
    <tr>
      <td>${escHtml(item.id || '')}</td>
      <td>${escHtml(item['国'] || '')}</td>
      <td>${escHtml(item['地域'] || '')}</td>
      <td>${escHtml(item['ジャンル'] || '')}</td>
      <td>${escHtml(item['スコープ'] || '')}</td>
      <td class="td-meta-short">${escHtml((item['メタ知識'] || '').slice(0, 40))}${(item['メタ知識'] || '').length > 40 ? '…' : ''}</td>
      <td>${escHtml(item['登録日'] || '')}</td>
      <td>${escHtml(supName)}</td>
      <td class="td-actions">
        <button class="btn btn-sm btn-edit" onclick="openEditModal('approved','${escHtml(item.id || '')}')">詳細</button>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr>
      <th>ID</th><th>国</th><th>地域</th><th>ジャンル</th><th>スコープ</th>
      <th>メタ知識</th><th>登録日</th><th>監修者</th><th>操作</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// ===========================
// 7. タブ2：全データ管理（管理者）
// ===========================
async function loadAllData() {
  const wrap = document.getElementById('all-table-wrap');
  wrap.innerHTML = '<p class="loading-text">読み込み中...</p>';
  try {
    state.allData = await fetchAllData(state.token);
    renderAllTable();
  } catch (e) {
    wrap.innerHTML = `<p class="error-text">読み込みエラー: ${escHtml(e.message)}</p>`;
  }
}

function renderAllTable() {
  const wrap   = document.getElementById('all-table-wrap');
  const filter = document.getElementById('all-filter').value;
  const data   = filter ? state.allData.filter(d => d.公開ステータス === filter) : state.allData;

  if (!data.length) {
    wrap.innerHTML = '<p class="empty-text">データがありません</p>';
    return;
  }

  const rows = data.map(item => `
    <tr>
      <td>${escHtml(item.id)}</td>
      <td>${escHtml(item.投稿者名 || '')}</td>
      <td>${escHtml(item.国 || '')}</td>
      <td>${escHtml(item.ジャンル || '')}</td>
      <td>${statusBadgeHtml(item.公開ステータス)}</td>
      <td>${escHtml(item.登録日 || '')}</td>
      <td class="td-actions">
        <button class="btn btn-sm btn-edit"   onclick="openEditModal('all','${escHtml(item.id)}')">編集</button>
        <button class="btn btn-sm btn-muted"  onclick="setStatus('${escHtml(item.id)}','非公開')">非公開</button>
        <button class="btn btn-sm btn-muted"  onclick="setStatus('${escHtml(item.id)}','再確認待ち')">監修前に戻す</button>
        <button class="btn btn-sm btn-danger" onclick="confirmDelete('${escHtml(item.id)}')">削除</button>
      </td>
    </tr>
  `).join('');

  wrap.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr>
      <th>ID</th><th>投稿者名</th><th>国</th><th>ジャンル</th>
      <th>ステータス</th><th>登録日</th><th>操作</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

document.getElementById('all-filter').addEventListener('change', renderAllTable);

async function setStatus(id, newStatus) {
  if (!confirm(`ステータスを「${newStatus}」に変更しますか？`)) return;
  try {
    await updateStatus(id, newStatus, '', state.token);
    showToast(`「${newStatus}」に変更しました`);
    await loadAllData();
    await loadPending();
  } catch (e) { alert('エラー: ' + e.message); }
}

async function confirmDelete(id) {
  if (!confirm(`ID: ${id} を削除します。この操作は取り消せません。よろしいですか？`)) return;
  try {
    await deleteData(id, state.token);
    showToast('削除しました');
    await loadAllData();
    await loadPending();
  } catch (e) { alert('エラー: ' + e.message); }
}

// ===========================
// 8. タブ3：監修者マスター（管理者）
// ===========================
async function loadSupervisors() {
  const wrap = document.getElementById('supervisor-table-wrap');
  wrap.innerHTML = '<p class="loading-text">読み込み中...</p>';
  try {
    state.supervisors = await fetchSupervisors(state.token);
    renderSupervisorTable();
    populateSupervisorDropdown();
  } catch (e) {
    wrap.innerHTML = `<p class="error-text">読み込みエラー: ${escHtml(e.message)}</p>`;
  }
}

function renderSupervisorTable() {
  const wrap = document.getElementById('supervisor-table-wrap');
  if (!state.supervisors.length) {
    wrap.innerHTML = '<p class="empty-text">監修者データがありません</p>';
    return;
  }

  const rows = state.supervisors.map(sup => `
    <tr>
      <td>${escHtml(sup.監修者ID || '')}</td>
      <td>${escHtml(sup.名前 || '')}</td>
      <td>${escHtml(sup.GeoGuessrレート || '')}</td>
      <td>${escHtml(sup.得意分野 || '')}</td>
      <td>${escHtml(sup.一言プロフィール || '')}</td>
      <td>
        <button class="btn btn-sm btn-edit" onclick="openSupervisorModal('${escHtml(sup.監修者ID)}')">編集</button>
      </td>
    </tr>
  `).join('');

  wrap.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr>
      <th>監修者ID</th><th>名前</th><th>レート</th><th>得意分野</th><th>一言プロフィール</th><th>操作</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// ===========================
// 9. タブ4：登録者管理（管理者）
// ===========================
function renderRegistrantTable() {
  const wrap = document.getElementById('registrant-table-wrap');
  if (!state.allData.length) {
    wrap.innerHTML = '<p class="empty-text">先に全データを読み込んでください</p>';
    return;
  }

  const counts = {};
  state.allData.forEach(d => {
    const name = d.投稿者名 || '（名前なし）';
    counts[name] = (counts[name] || 0) + 1;
  });

  const rows = Object.keys(counts).sort().map(name => `
    <tr>
      <td>${escHtml(name)}</td>
      <td>${counts[name]}</td>
      <td class="td-actions">
        <button class="btn btn-sm btn-edit"   onclick="renameRegistrant('${escHtml(name)}')">名前を変更</button>
        <button class="btn btn-sm btn-danger" onclick="blockRegistrant('${escHtml(name)}')">ブロック</button>
      </td>
    </tr>
  `).join('');

  wrap.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>投稿者名</th><th>投稿件数</th><th>操作</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

async function renameRegistrant(oldName) {
  const newName = prompt(`「${oldName}」の新しい名前を入力してください：`);
  if (!newName || newName.trim() === oldName) return;

  const targets = state.allData.filter(d => d.投稿者名 === oldName);
  if (!confirm(`「${oldName}」→「${newName}」に変更します（${targets.length}件）。よろしいですか？`)) return;

  try {
    for (const item of targets) {
      await updateData(item.id, { 投稿者名: newName.trim() }, state.token);
    }
    showToast(`${targets.length}件の投稿者名を変更しました`);
    await loadAllData();
    renderRegistrantTable();
  } catch (e) { alert('エラー: ' + e.message); }
}

async function blockRegistrant(name) {
  const targets = state.allData.filter(d => d.投稿者名 === name);
  if (!confirm(`「${name}」の投稿 ${targets.length}件 を全て非公開にします。よろしいですか？`)) return;

  try {
    for (const item of targets) {
      await updateStatus(item.id, '非公開', '', state.token);
    }
    showToast(`${targets.length}件を非公開にしました`);
    await loadAllData();
    renderRegistrantTable();
  } catch (e) { alert('エラー: ' + e.message); }
}

// ===========================
// 10. 編集モーダル
// ===========================
function openEditModal(context, id) {
  const item = context === 'pending'
    ? state.pending.find(d => d.id === id)
    : context === 'approved'
      ? state.approvedData.find(d => d.id === id)
      : state.allData.find(d => d.id === id);
  if (!item) return;

  state.currentEdit = { item, context };

  // ヘッダー
  document.getElementById('edit-id').textContent        = '#' + item.id;
  document.getElementById('edit-poster').textContent    = item.投稿者名 || '';
  document.getElementById('edit-current-status').innerHTML = statusBadgeHtml(item.公開ステータス);

  // フィールド
  document.getElementById('edit-country').value   = item.国 || '';
  document.getElementById('edit-region').value    = item.地域 || '';
  document.getElementById('edit-scope').value     = item.スコープ || '';
  document.getElementById('edit-genre').value     = item.ジャンル || '';
  document.getElementById('edit-meta').value      = item.メタ知識 || '';
  document.getElementById('edit-supplement').value = item.補足 || '';
  document.getElementById('edit-sv-url').value    = item.参考SVリンク || '';
  document.getElementById('edit-ref-url').value   = item.参考サイト || '';
  document.getElementById('edit-image-url').value = item.画像URL || '';
  document.getElementById('edit-image-credit').value = item.画像クレジット || '';
  document.getElementById('edit-trivia').value    = item.Trivia用テキスト || '';
  document.getElementById('edit-memo').textContent = item.監修者へのメモ || '（なし）';
  document.getElementById('edit-return-reason').value = item.備考 || '';
  document.getElementById('edit-supervisor-select').value = item.監修者ID || '';

  updateEditImagePreview(item.画像URL || '');
  updateTriviaCounter();

  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  state.currentEdit = null;
}

// 画像プレビュー
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

// Triviaカウンター
document.getElementById('edit-trivia').addEventListener('input', updateTriviaCounter);
function updateTriviaCounter() {
  const len     = document.getElementById('edit-trivia').value.length;
  const counter = document.getElementById('trivia-counter');
  counter.textContent = `${len} / 300文字`;
  counter.className   = 'char-counter' + (len > 300 ? ' over' : '');
}

// 編集内容を収集
function collectEditFields() {
  return {
    国:               document.getElementById('edit-country').value.trim(),
    地域:             document.getElementById('edit-region').value.trim(),
    スコープ:         document.getElementById('edit-scope').value,
    ジャンル:         document.getElementById('edit-genre').value,
    メタ知識:         document.getElementById('edit-meta').value.trim(),
    補足:             document.getElementById('edit-supplement').value.trim(),
    参考SVリンク:     document.getElementById('edit-sv-url').value.trim(),
    参考サイト:       document.getElementById('edit-ref-url').value.trim(),
    画像URL:          document.getElementById('edit-image-url').value.trim(),
    画像クレジット:   document.getElementById('edit-image-credit').value.trim(),
    Trivia用テキスト: document.getElementById('edit-trivia').value.trim(),
  };
}

function getReturnReason() {
  return document.getElementById('edit-return-reason').value.trim();
}

// 承認して公開
document.getElementById('edit-approve').addEventListener('click', async () => {
  if (!state.currentEdit) return;
  const supId = document.getElementById('edit-supervisor-select').value;
  if (!supId) { alert('担当監修者を選択してください'); return; }

  const { item } = state.currentEdit;
  try {
    await updateData(item.id, { ...collectEditFields(), 備考: '' }, state.token);
    await updateStatus(item.id, '公開', supId, state.token);
    showToast('承認して公開しました');
    closeEditModal();
    await loadPending();
    if (state.mode === 'admin') await loadAllData();
  } catch (e) { alert('エラー: ' + e.message); }
});

// 差し戻し
document.getElementById('edit-reject').addEventListener('click', async () => {
  if (!state.currentEdit) return;
  const reason = getReturnReason();
  if (!reason) {
    alert('差し戻し理由を入力してください');
    document.getElementById('edit-return-reason').focus();
    return;
  }
  const { item } = state.currentEdit;
  try {
    await updateData(item.id, { ...collectEditFields(), 備考: reason }, state.token);
    await updateStatus(item.id, '差し戻し', '', state.token);
    showToast('差し戻しました');
    closeEditModal();
    await loadPending();
    if (state.mode === 'admin') await loadAllData();
  } catch (e) { alert('エラー: ' + e.message); }
});

// 保存のみ
document.getElementById('edit-save').addEventListener('click', async () => {
  if (!state.currentEdit) return;
  const { item } = state.currentEdit;
  try {
    await updateData(item.id, collectEditFields(), state.token);
    showToast('保存しました');
    closeEditModal();
    await loadPending();
    if (state.mode === 'admin') await loadAllData();
  } catch (e) { alert('エラー: ' + e.message); }
});

document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
document.getElementById('edit-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditModal();
});

// ===========================
// 11. 監修者モーダル
// ===========================
function openSupervisorModal(supervisorId) {
  const isNew = !supervisorId;
  const sup   = isNew ? {} : (state.supervisors.find(s => s.監修者ID === supervisorId) || {});

  state.currentSupEdit = isNew ? null : sup;

  document.getElementById('sup-modal-title').textContent = isNew ? '監修者を追加' : '監修者を編集';
  document.getElementById('sup-id').value       = sup.監修者ID || '';
  document.getElementById('sup-id').disabled    = !isNew;
  document.getElementById('sup-name').value     = sup.名前 || '';
  document.getElementById('sup-rate').value     = sup.GeoGuessrレート || '';
  document.getElementById('sup-specialty').value = sup.得意分野 || '';
  document.getElementById('sup-profile').value  = sup.一言プロフィール || '';
  document.getElementById('sup-url').value      = sup.GeoGuessrプロフURL || '';

  document.getElementById('supervisor-modal').classList.remove('hidden');
}

function closeSupervisorModal() {
  document.getElementById('supervisor-modal').classList.add('hidden');
  state.currentSupEdit = null;
}

document.getElementById('sup-save').addEventListener('click', async () => {
  const isNew = !state.currentSupEdit;
  const data  = {
    監修者ID:           document.getElementById('sup-id').value.trim(),
    名前:               document.getElementById('sup-name').value.trim(),
    GeoGuessrレート:    document.getElementById('sup-rate').value.trim(),
    得意分野:           document.getElementById('sup-specialty').value.trim(),
    一言プロフィール:   document.getElementById('sup-profile').value.trim(),
    GeoGuessrプロフURL: document.getElementById('sup-url').value.trim(),
  };
  if (!data.監修者ID || !data.名前) { alert('監修者IDと名前は必須です'); return; }

  try {
    if (isNew) {
      await addSupervisor(data, state.token);
    } else {
      await updateSupervisorData(data.監修者ID, data, state.token);
    }
    showToast(isNew ? '監修者を追加しました' : '更新しました');
    closeSupervisorModal();
    await loadSupervisors();
  } catch (e) { alert('エラー: ' + e.message); }
});

document.getElementById('sup-cancel').addEventListener('click', closeSupervisorModal);
document.getElementById('supervisor-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeSupervisorModal();
});

// ===========================
// 12. ユーティリティ
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
  return `<span class="badge" style="${style}">${escHtml(status || '不明')}</span>`;
}

function populateSupervisorDropdown() {
  const sel = document.getElementById('edit-supervisor-select');
  sel.innerHTML = '<option value="">担当監修者を選択</option>';
  state.supervisors.forEach(sup => {
    const opt = document.createElement('option');
    opt.value = sup.監修者ID;
    opt.textContent = `${sup.名前}（${sup.監修者ID}）`;
    sel.appendChild(opt);
  });
}

// ジャンルselectを動的生成（selectedValueを指定すると選択状態になる）
function populateGenreDropdown(selectId, selectedValue) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const current = selectedValue || sel.value;
  sel.innerHTML = '';
  state.genres.forEach(g => {
    const opt = document.createElement('option');
    opt.value       = g.ジャンル名;
    opt.textContent = g.ジャンル名;
    if (g.ジャンル名 === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ===========================
// 13. タブ5：ジャンル管理（管理者）
// ===========================
async function loadGenres() {
  const wrap = document.getElementById('genre-table-wrap');
  wrap.innerHTML = '<p class="loading-text">読み込み中...</p>';
  try {
    state.genres = await fetchGenres();
    updateGenreStylesFromData(state.genres);
    renderGenreTable();
  } catch (e) {
    wrap.innerHTML = `<p class="error-text">読み込みエラー: ${escHtml(e.message)}</p>`;
  }
}

function renderGenreTable() {
  const wrap = document.getElementById('genre-table-wrap');
  if (!state.genres.length) {
    wrap.innerHTML = '<p class="empty-text">ジャンルデータがありません</p>';
    return;
  }

  const rows = state.genres.map(g => `
    <tr>
      <td>${escHtml(g.ジャンルID)}</td>
      <td>${escHtml(g.ジャンル名)}</td>
      <td style="text-align:center;">
        <span class="badge" style="background:${escHtml(g.背景色)};color:${escHtml(g.文字色)};">${escHtml(g.ジャンル名)}</span>
      </td>
      <td class="td-actions">
        <button class="btn btn-sm btn-edit"   onclick="openGenreModal('${escHtml(g.ジャンルID)}')">編集</button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteGenre('${escHtml(g.ジャンルID)}','${escHtml(g.ジャンル名)}')">削除</button>
      </td>
    </tr>
  `).join('');

  wrap.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr>
      <th>ジャンルID</th><th>ジャンル名</th><th>バッジプレビュー</th><th>操作</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// ジャンルモーダル
function openGenreModal(genreId) {
  const isNew = !genreId;
  const g     = isNew ? {} : (state.genres.find(x => x.ジャンルID === genreId) || {});

  state.currentGenreEdit = isNew ? null : g;

  document.getElementById('genre-modal-title').textContent = isNew ? 'ジャンルを追加' : 'ジャンルを編集';
  document.getElementById('genre-id').value       = g.ジャンルID  || '';
  document.getElementById('genre-id').disabled    = !isNew;
  document.getElementById('genre-name').value     = g.ジャンル名  || '';
  document.getElementById('genre-bg-picker').value   = g.背景色  || '#F1EFE8';
  document.getElementById('genre-bg-text').value     = g.背景色  || '#F1EFE8';
  document.getElementById('genre-text-picker').value = g.文字色  || '#444441';
  document.getElementById('genre-text-text').value   = g.文字色  || '#444441';
  document.getElementById('genre-order').value    = g.表示順  ?? 99;

  updateGenreBadgePreview();
  document.getElementById('genre-modal').classList.remove('hidden');
}

function closeGenreModal() {
  document.getElementById('genre-modal').classList.add('hidden');
  state.currentGenreEdit = null;
}

// バッジプレビューをリアルタイム更新
function updateGenreBadgePreview() {
  const name  = document.getElementById('genre-name').value    || 'ジャンル名';
  const bg    = document.getElementById('genre-bg-text').value || '#F1EFE8';
  const color = document.getElementById('genre-text-text').value || '#444441';
  const preview = document.getElementById('genre-badge-preview');
  preview.textContent    = name;
  preview.style.background = bg;
  preview.style.color      = color;
}

// カラーピッカー ↔ テキスト入力の同期
['bg', 'text'].forEach(type => {
  document.getElementById(`genre-${type}-picker`).addEventListener('input', function () {
    document.getElementById(`genre-${type}-text`).value = this.value;
    updateGenreBadgePreview();
  });
  document.getElementById(`genre-${type}-text`).addEventListener('input', function () {
    if (/^#[0-9A-Fa-f]{6}$/.test(this.value)) {
      document.getElementById(`genre-${type}-picker`).value = this.value;
    }
    updateGenreBadgePreview();
  });
});

document.getElementById('genre-name').addEventListener('input', updateGenreBadgePreview);

// 保存
document.getElementById('genre-save').addEventListener('click', async () => {
  const isNew = !state.currentGenreEdit;
  const data  = {
    ジャンルID: document.getElementById('genre-id').value.trim(),
    ジャンル名: document.getElementById('genre-name').value.trim(),
    背景色:     document.getElementById('genre-bg-text').value.trim(),
    文字色:     document.getElementById('genre-text-text').value.trim(),
    表示順:     Number(document.getElementById('genre-order').value) || 99,
  };
  if (!data.ジャンルID || !data.ジャンル名) { alert('ジャンルIDとジャンル名は必須です'); return; }

  try {
    if (isNew) {
      await addGenreData(data, state.token);
    } else {
      await updateGenreData(data.ジャンルID, data, state.token);
    }
    showToast(isNew ? 'ジャンルを追加しました' : 'ジャンルを更新しました');
    closeGenreModal();
    await loadGenres();
    // 編集モーダルのドロップダウンも更新
    populateGenreDropdown('edit-genre');
  } catch (e) { alert('エラー: ' + e.message); }
});

document.getElementById('genre-cancel').addEventListener('click', closeGenreModal);
document.getElementById('genre-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeGenreModal();
});

async function confirmDeleteGenre(id, name) {
  if (!confirm(`ジャンル「${name}」を削除します。よろしいですか？`)) return;
  try {
    await deleteGenreData(id, state.token);
    showToast('削除しました');
    await loadGenres();
    populateGenreDropdown('edit-genre');
  } catch (e) { alert('エラー: ' + e.message); }
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
