// ===== GAS連携モジュール =====
// 公開用の既定URL。ローカルでは js/config.js の GAS_URL で上書きできる。
// トークンも js/config.js で管理（.gitignoreで除外）。
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzgl6saHmZ4K9yBLp5CoHB1RAz8Ogzs9gVsYp04L2hODgzaVuqW7lZNf0eAbNprzj9MZQ/exec';
const ACTIVE_GAS_URL = (typeof GAS_URL !== 'undefined' && GAS_URL) ? GAS_URL : DEFAULT_GAS_URL;

// ===== GET系 =====

// 公開データ取得（閲覧ページ用・認証不要）
async function fetchPublicData() {
  if (!ACTIVE_GAS_URL) return MOCK_DATA; // GAS未設定時はモックデータを返す
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=getPublic`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json.data;
}

// 全データ取得（管理者用）
async function fetchAllData(token) {
  if (!ACTIVE_GAS_URL) throw new Error('GAS_URLが設定されていません（js/config.js または js/gas.js を確認してください）');
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=getAll&token=${encodeURIComponent(token)}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json.data;
}

// 監修待ちデータ取得（監修者用）
async function fetchPendingData(token) {
  if (!ACTIVE_GAS_URL) throw new Error('GAS_URLが設定されていません（js/config.js または js/gas.js を確認してください）');
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=getPending&token=${encodeURIComponent(token)}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json.data;
}

// 監修者マスター取得
async function fetchSupervisors(token) {
  if (!ACTIVE_GAS_URL) throw new Error('GAS_URLが設定されていません（js/config.js または js/gas.js を確認してください）');
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=getSupervisors&token=${encodeURIComponent(token)}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json.data;
}

// ===== POST系 =====

// 新規登録（登録フォーム用）
async function submitRegistration(formData) {
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=register`, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify(formData),
  });
  return await res.json();
}

// ステータス更新（監修者用）
async function updateStatus(id, status, supervisorId, token) {
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=updateStatus&token=${encodeURIComponent(token)}`, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify({ id, status, supervisorId }),
  });
  return await res.json();
}

// データ編集（監修者・管理者用）
async function updateData(id, fields, token) {
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=update&token=${encodeURIComponent(token)}`, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify({ id, ...fields }),
  });
  return await res.json();
}

// データ削除（管理者用）
async function deleteData(id, token) {
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=delete&token=${encodeURIComponent(token)}`, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify({ id }),
  });
  return await res.json();
}

// 監修者追加（管理者用）
// ※ GAS側に action=addSupervisor の実装が必要
async function addSupervisor(data, token) {
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=addSupervisor&token=${encodeURIComponent(token)}`, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify(data),
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json;
}

// 監修者更新（管理者用）
// ※ GAS側に action=updateSupervisor の実装が必要
async function updateSupervisorData(id, data, token) {
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=updateSupervisor&token=${encodeURIComponent(token)}`, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify({ 監修者ID: id, ...data }),
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json;
}

// ===== ジャンル関連 =====

// GAS未設定時のデフォルトジャンル（フォールバック用）
const DEFAULT_GENRES = [
  { ジャンルID: 'genre_01', ジャンル名: '標識',      背景色: '#E6F1FB', 文字色: '#0C447C', 表示順: 1 },
  { ジャンルID: 'genre_02', ジャンル名: '道路番号',   背景色: '#EAF3DE', 文字色: '#27500A', 表示順: 2 },
  { ジャンルID: 'genre_03', ジャンル名: '植生',       背景色: '#E1F5EE', 文字色: '#085041', 表示順: 3 },
  { ジャンルID: 'genre_04', ジャンル名: '地形・景観', 背景色: '#FAEEDA', 文字色: '#633806', 表示順: 4 },
  { ジャンルID: 'genre_05', ジャンル名: '言語・文字', 背景色: '#FEF3C7', 文字色: '#633806', 表示順: 5 },
  { ジャンルID: 'genre_06', ジャンル名: 'マンホール', 背景色: '#DBEAFE', 文字色: '#1E3A8A', 表示順: 6 },
  { ジャンルID: 'genre_07', ジャンル名: '車種',       背景色: '#F1EFE8', 文字色: '#444441', 表示順: 7 },
  { ジャンルID: 'genre_08', ジャンル名: '建物',       背景色: '#EAF3DE', 文字色: '#27500A', 表示順: 8 },
  { ジャンルID: 'genre_09', ジャンル名: 'その他',     背景色: '#F1EFE8', 文字色: '#444441', 表示順: 99 },
];

// ジャンル一覧取得（認証不要・「その他」を末尾に移動）
async function fetchGenres() {
  if (!ACTIVE_GAS_URL) {
    // GAS未設定時はデフォルトを返す
    const others = DEFAULT_GENRES.filter(g => g.ジャンル名 === 'その他');
    const rest   = DEFAULT_GENRES.filter(g => g.ジャンル名 !== 'その他');
    return [...rest, ...others];
  }
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=getGenres`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  // 「その他」を末尾に移動（GAS側でもやっているが念のため）
  const genres = json.data;
  const others = genres.filter(g => g.ジャンル名 === 'その他');
  const rest   = genres.filter(g => g.ジャンル名 !== 'その他');
  return [...rest, ...others];
}

// ジャンル追加（管理者用）
async function addGenreData(data, token) {
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=addGenre&token=${encodeURIComponent(token)}`, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify(data),
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json;
}

// ジャンル更新（管理者用）
async function updateGenreData(id, data, token) {
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=updateGenre&token=${encodeURIComponent(token)}`, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify({ ジャンルID: id, ...data }),
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json;
}

// ジャンル削除（管理者用）
async function deleteGenreData(id, token) {
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=deleteGenre&token=${encodeURIComponent(token)}`, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify({ id }),
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json;
}

// ===== マイページ用 =====

// 投稿者名で自分の投稿を取得（認証不要）
async function fetchMyData(name) {
  if (!ACTIVE_GAS_URL) throw new Error('GAS_URLが設定されていません');
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=getMyData&name=${encodeURIComponent(name)}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json.data;
}

// 投稿を修正して再送信（認証不要・投稿者名で照合）
async function updateMyData(name, id, fields) {
  const res  = await fetch(`${ACTIVE_GAS_URL}?action=updateMyData`, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify({ name, id, ...fields }),
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json;
}

// browse.js との互換エイリアス
const fetchTips = fetchPublicData;
