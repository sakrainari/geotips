// ジャンルスタイルマップ（GASから更新可能・フォールバックあり）
let GENRE_STYLES_MAP = {
  "標識":      { bg: "#E6F1FB", color: "#0C447C" },
  "道路番号":  { bg: "#EAF3DE", color: "#27500A" },
  "植生":      { bg: "#E1F5EE", color: "#085041" },
  "地形・景観":{ bg: "#FAEEDA", color: "#633806" },
  "言語・文字":{ bg: "#FEF3C7", color: "#633806" },
  "マンホール":{ bg: "#DBEAFE", color: "#1E3A8A" },
  "車種":      { bg: "#F1EFE8", color: "#444441" },
  "建物":      { bg: "#EAF3DE", color: "#27500A" },
  "その他":    { bg: "#F1EFE8", color: "#444441" },
};

// GASから取得したジャンルデータでスタイルマップを更新
function updateGenreStylesFromData(genres) {
  genres.forEach(g => {
    if (g.ジャンル名 && g.背景色 && g.文字色) {
      GENRE_STYLES_MAP[g.ジャンル名] = { bg: g.背景色, color: g.文字色 };
    }
  });
}

function genreBadgeStyle(genre) {
  const s = GENRE_STYLES_MAP[genre] || GENRE_STYLES_MAP["その他"] || { bg: "#F1EFE8", color: "#444441" };
  return `background:${s.bg};color:${s.color};`;
}

// ===== 複数ジャンル対応ヘルパー =====
const GENRE_SEP = '、';

// "標識、車種" → ["標識","車種"]（「、」「,」どちらの区切りも許容・空要素は除去）
function splitGenres(value) {
  if (Array.isArray(value)) return value.map(s => String(s).trim()).filter(Boolean);
  return String(value || '').split(/[、,]/).map(s => s.trim()).filter(Boolean);
}

// ["標識","車種"] → "標識、車種"
function joinGenres(arr) {
  return (arr || []).map(s => String(s).trim()).filter(Boolean).join(GENRE_SEP);
}

// 複数ジャンルを色付きバッジHTMLにまとめて変換
function genreBadgesHtml(value) {
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  return splitGenres(value)
    .map(g => `<span class="badge genre-badge" style="${genreBadgeStyle(g)}">${esc(g)}</span>`)
    .join(' ');
}

// multiple selectの選択値を配列で取得
function getSelectedGenres(selectEl) {
  return [...selectEl.selectedOptions].map(o => o.value).filter(Boolean);
}

// 「、」区切り文字列（または配列）に一致するoptionを選択状態にする
function setSelectedGenres(selectEl, value) {
  const set = new Set(splitGenres(value));
  [...selectEl.options].forEach(o => { o.selected = set.has(o.value); });
}

function scopeBadgeStyle(scope) {
  return scope === "Country"
    ? "background:#3B1FA3;color:#E9D5FF;"
    : "background:#9A3412;color:#FFEDD5;";
}

// ===== テーマ切替 =====
function initTheme() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  // ボタンアイコンを現在のテーマに合わせる
  function updateIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '🌙' : '☀️';
    btn.title = isDark ? 'ライトモードに切替' : 'ダークモードに切替';
  }

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateIcon();
  });

  updateIcon();
}

// DOMが読み込まれたら初期化
document.addEventListener('DOMContentLoaded', initTheme);
