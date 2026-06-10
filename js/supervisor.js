// ===========================
// 1. 状態管理
// ===========================
const state = {
  token:        null,
  supervisorId: null,   // ログイン後に選択した自分の監修者ID
  pending:      [],
  supervisors:  [],
  currentEdit:  null,
};

// ===========================
// 2. 初期化
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  // config.jsにSUPERVISOR_TOKENがあればプリフィル
  const preToken = (typeof SUPERVISOR_TOKEN !== 'undefined') ? SUPERVISOR_TOKEN : '';
  if (preToken) document.getElementById('token-input').value = preToken;
});

// ===========================
// 3. トークンモーダル（2ステップ）
// ===========================
document.getElementById('token-submit').addEventListener('click', handleTokenSubmit);
document.getElementById('token-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleTokenSubmit();
});

document.getElementById('sup-select-submit').addEventListener('click', handleSupSelectSubmit);

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

    if (mode === 'admin') {
      // 管理者トークンは拒否
      errEl.textContent = '管理者トークンは使用できません。監修者トークンを入力してください。';
      errEl.classList.add('visible');
      return;
    }
    if (!mode) {
      errEl.textContent = 'トークンが正しくありません';
      errEl.classList.add('visible');
      return;
    }

    // 監修者トークン OK → 監修者選択ステップへ
    state.token = token;
    sessionStorage.setItem('sup_token', token);

    // 監修者マスターを取得してドロップダウンを作る
    state.supervisors = await fetchSupervisors(token);
    populateSupSelect();

    // ステップ切替
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');

  } catch (e) {
    errEl.textContent = 'エラー: ' + e.message;
    errEl.classList.add('visible');
  } finally {
    btn.textContent = '確認する';
    btn.disabled    = false;
  }
}

function populateSupSelect() {
  const sel = document.getElementById('sup-select');
  sel.innerHTML = '<option value="">選択してください</option>';
  state.supervisors.forEach(sup => {
    const opt = document.createElement('option');
    opt.value       = sup.監修者ID;
    opt.textContent = `${sup.名前}（${sup.監修者ID}）`;
    sel.appendChild(opt);
  });
}

function handleSupSelectSubmit() {
  const supId = document.getElementById('sup-select').value;
  const errEl = document.getElementById('sup-select-error');
  if (!supId) {
    errEl.textContent = '監修者を選択してください';
    errEl.classList.add('visible');
    return;
  }
  errEl.classList.remove('visible');

  state.supervisorId = supId;
  sessionStorage.setItem('sup_id', supId);

  document.getElementById('token-modal').classList.add('hidden');
  setupUI();
  loadInitialData();
}

// ===========================
// 4. トークン種別判定
// ===========================
// supervisorトークン → 'supervisor'
// adminトークン     → 'admin'（拒否用）
// 無効              → null
async function detectMode(token) {
  try {
    await fetchAllData(token);
    return 'admin';
  } catch (e) {
    if (e.message !== 'Unauthorized' && !e.message.includes('GAS_URL')) throw e;
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
// 5. UIセットアップ
// ===========================
function setupUI() {
  const sup = state.supervisors.find(s => s.監修者ID === state.supervisorId);
  const name = sup ? sup.名前 : state.supervisorId;

  document.getElementById('logged-in-name').textContent = name;
  document.getElementById('header-sup-info').classList.remove('hidden');

  // タブイベント
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('tab-nav').classList.remove('hidden');
}

// ===========================
// 6. タブ管理
// ===========================
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));

  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
  const panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.remove('hidden');

  if (tabId === 'profile') renderSupervisorProfile();
}

// ===========================
// 7. 初期データ読み込み
// ===========================
async function loadInitialData() {
  // ジャンルドロップダウンを動的生成
  try {
    const genres = await fetchGenres();
    updateGenreStylesFromData(genres);
    populateGenreSelect('edit-genre', genres);
  } catch (e) {
    console.warn('ジャンル取得失敗（デフォルトを使用）:', e.message);
    // フォールバック：DEFAULT_GENRESを使用
    if (typeof DEFAULT_GENRES !== 'undefined') {
      populateGenreSelect('edit-genre', DEFAULT_GENRES);
    }
  }
  await loadPending();
  switchTab('pending');
}

// ジャンルselectを動的に生成
function populateGenreSelect(selectId, genres, selectedValue) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  // 複数ジャンル対応：明示指定があればそれ、無ければ現在の選択を維持
  const currentSet = new Set(splitGenres(selectedValue != null ? selectedValue : getSelectedGenres(sel)));
  sel.innerHTML = '';
  genres.forEach(g => {
    const opt = document.createElement('option');
    opt.value       = g.ジャンル名;
    opt.textContent = g.ジャンル名;
    if (currentSet.has(g.ジャンル名)) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ===========================
// 8. タブ1：監修待ち一覧
// ===========================
async function loadPending() {
  const wrap = document.getElementById('pending-table-wrap');
  wrap.innerHTML = '<p class="loading-text">読み込み中...</p>';
  try {
    state.pending = await fetchPendingData(state.token);
    renderPendingTable();
  } catch (e) {
    wrap.innerHTML = `<p class="error-text">読み込みエラー: ${escHtml(e.message)}</p>`;
  }
}

function renderPendingTable() {
  const wrap = document.getElementById('pending-table-wrap');
  if (!state.pending.length) {
    wrap.innerHTML = '<p class="empty-text">監修待ちデータはありません ✓</p>';
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
        <button class="btn btn-sm btn-primary" onclick="openEditModal('${escHtml(item.id)}')">監修する</button>
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

// ===========================
// 9. タブ2：監修者情報
// ===========================
function renderSupervisorProfile() {
  const wrap = document.getElementById('profile-wrap');
  const sup  = state.supervisors.find(s => s.監修者ID === state.supervisorId);

  if (!sup) {
    wrap.innerHTML = '<p class="empty-text">監修者情報が見つかりません</p>';
    return;
  }

  const profileUrl = sup.GeoGuessrプロフURL
    ? `<a href="${escHtml(sup.GeoGuessrプロフURL)}" target="_blank" rel="noopener">${escHtml(sup.GeoGuessrプロフURL)}</a>`
    : '（未設定）';

  wrap.innerHTML = `
    <div class="supervisor-profile" id="profile-card">

      <!-- 読み取り専用行（ID・名前） -->
      <div class="profile-row">
        <span class="profile-label">監修者ID <span class="profile-readonly-note">変更不可</span></span>
        <span class="profile-value">${escHtml(sup.監修者ID)}</span>
      </div>
      <div class="profile-row">
        <span class="profile-label">名前 <span class="profile-readonly-note">変更不可</span></span>
        <span class="profile-value">${escHtml(sup.名前)}</span>
      </div>

      <!-- 編集可能行 -->
      <div class="profile-row" data-field="GeoGuessrレート">
        <span class="profile-label">GeoGuessrレート</span>
        <span class="profile-value view-mode">${escHtml(sup.GeoGuessrレート || '（未設定）')}</span>
        <input class="profile-input edit-mode hidden" type="text" value="${escHtml(sup.GeoGuessrレート || '')}" placeholder="例：42,000">
      </div>
      <div class="profile-row" data-field="得意分野">
        <span class="profile-label">得意分野</span>
        <span class="profile-value view-mode">${escHtml(sup.得意分野 || '（未設定）')}</span>
        <input class="profile-input edit-mode hidden" type="text" value="${escHtml(sup.得意分野 || '')}" placeholder="例：日本・東欧特化">
      </div>
      <div class="profile-row" data-field="一言プロフィール">
        <span class="profile-label">一言プロフィール</span>
        <span class="profile-value view-mode">${escHtml(sup.一言プロフィール || '（未設定）')}</span>
        <input class="profile-input edit-mode hidden" type="text" value="${escHtml(sup.一言プロフィール || '')}" placeholder="例：GeoGuessr歴3年">
      </div>
      <div class="profile-row" data-field="GeoGuessrプロフURL">
        <span class="profile-label">プロフィールURL</span>
        <span class="profile-value view-mode">${profileUrl}</span>
        <input class="profile-input edit-mode hidden" type="url" value="${escHtml(sup.GeoGuessrプロフURL || '')}" placeholder="https://www.geoguessr.com/user/...">
      </div>

      <!-- ボタン群 -->
      <div class="profile-actions" id="profile-actions-view">
        <button class="btn btn-edit" onclick="enterProfileEditMode()">情報を編集</button>
      </div>
      <div class="profile-actions hidden" id="profile-actions-edit">
        <button class="btn btn-approve" onclick="saveProfileEdit()">保存</button>
        <button class="btn btn-muted"   onclick="cancelProfileEdit()">キャンセル</button>
      </div>

      <p class="profile-note" id="profile-note">監修者IDと名前の変更は管理者にお問い合わせください。</p>
    </div>
  `;
}

function enterProfileEditMode() {
  document.querySelectorAll('#profile-card .view-mode').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('#profile-card .edit-mode').forEach(el => el.classList.remove('hidden'));
  document.getElementById('profile-actions-view').classList.add('hidden');
  document.getElementById('profile-actions-edit').classList.remove('hidden');
}

function cancelProfileEdit() {
  // プロフィールを再描画して編集前に戻す
  renderSupervisorProfile();
}

async function saveProfileEdit() {
  const fields = {};
  document.querySelectorAll('#profile-card [data-field]').forEach(row => {
    const field = row.dataset.field;
    const input = row.querySelector('.profile-input');
    if (input) fields[field] = input.value.trim();
  });

  try {
    await updateSupervisorData(state.supervisorId, fields, state.token);

    // stateのsupervisors配列を更新
    const idx = state.supervisors.findIndex(s => s.監修者ID === state.supervisorId);
    if (idx !== -1) state.supervisors[idx] = { ...state.supervisors[idx], ...fields };

    showToast('プロフィールを保存しました');
    renderSupervisorProfile(); // 表示モードに戻る
  } catch (e) {
    alert('保存エラー: ' + e.message);
  }
}

// ===========================
// 10. 編集モーダル
// ===========================
function openEditModal(id) {
  const item = state.pending.find(d => d.id === id);
  if (!item) return;
  state.currentEdit = item;

  // ヘッダー
  document.getElementById('edit-id').textContent         = '#' + item.id;
  document.getElementById('edit-poster').textContent     = item.投稿者名 || '';
  document.getElementById('edit-current-status').innerHTML = statusBadgeHtml(item.公開ステータス);

  // 担当監修者（読み取り専用・自動入力）
  const sup  = state.supervisors.find(s => s.監修者ID === state.supervisorId);
  document.getElementById('edit-supervisor-display').textContent =
    sup ? `${sup.名前}（${sup.監修者ID}）` : state.supervisorId;

  // フィールド
  document.getElementById('edit-country').value     = item.国 || '';
  document.getElementById('edit-region').value      = item.地域 || '';
  document.getElementById('edit-scope').value       = item.スコープ || '';
  setSelectedGenres(document.getElementById('edit-genre'), item.ジャンル);
  document.getElementById('edit-meta').value        = item.メタ知識 || '';
  document.getElementById('edit-supplement').value  = item.補足 || '';
  document.getElementById('edit-sv-url').value      = item.参考SVリンク || '';
  document.getElementById('edit-ref-url').value     = item.参考サイト || '';
  document.getElementById('edit-image-url').value   = item.画像URL || '';
  document.getElementById('edit-image-credit').value = item.画像クレジット || '';
  document.getElementById('edit-trivia').value      = item.Trivia用テキスト || '';
  document.getElementById('edit-memo').textContent  = item.監修者へのメモ || '（なし）';
  document.getElementById('edit-return-reason').value = item.備考 || '';

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
    ジャンル:         joinGenres(getSelectedGenres(document.getElementById('edit-genre'))),
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

// --- モーダルボタン ---

// 承認して公開
document.getElementById('edit-approve').addEventListener('click', async () => {
  if (!state.currentEdit) return;
  try {
    await updateData(state.currentEdit.id, { ...collectEditFields(), 備考: '' }, state.token);
    await updateStatus(state.currentEdit.id, '公開', state.supervisorId, state.token);
    showToast('承認して公開しました');
    closeEditModal();
    await loadPending();
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
  try {
    await updateData(state.currentEdit.id, { ...collectEditFields(), 備考: reason }, state.token);
    await updateStatus(state.currentEdit.id, '差し戻し', '', state.token);
    showToast('差し戻しました');
    closeEditModal();
    await loadPending();
  } catch (e) { alert('エラー: ' + e.message); }
});

// 監修前に戻す（再確認待ち）
document.getElementById('edit-revert').addEventListener('click', async () => {
  if (!state.currentEdit) return;
  if (!confirm('ステータスを「再確認待ち」に変更します。よろしいですか？')) return;
  try {
    await updateStatus(state.currentEdit.id, '再確認待ち', '', state.token);
    showToast('再確認待ちに変更しました');
    closeEditModal();
    await loadPending();
  } catch (e) { alert('エラー: ' + e.message); }
});

// 保存のみ
document.getElementById('edit-save').addEventListener('click', async () => {
  if (!state.currentEdit) return;
  try {
    await updateData(state.currentEdit.id, collectEditFields(), state.token);
    showToast('保存しました');
    closeEditModal();
    await loadPending();
  } catch (e) { alert('エラー: ' + e.message); }
});

// キャンセル
document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
document.getElementById('edit-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditModal();
});

// ===========================
// 11. ユーティリティ
// ===========================
const STATUS_STYLES = {
  '監修待ち':   'background:#F59E0B;color:#1C1917;',
  '差し戻し':   'background:#DC2626;color:#fff;',
  '再確認待ち': 'background:#7C3AED;color:#fff;',
  '公開':       'background:#16A34A;color:#fff;',
  '非公開':     'background:#64748B;color:#fff;',
};

function statusBadgeHtml(status) {
  const style = STATUS_STYLES[status] || 'background:#64748B;color:#fff;';
  return `<span class="badge" style="${style}">${escHtml(status || '不明')}</span>`;
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
