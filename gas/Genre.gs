// ===== ジャンルマスター =====

const GENRE_SHEET_NAME = 'ジャンルマスター';

// 列インデックス（0始まり）
const GENRE_COL = {
  ジャンルID: 0,
  ジャンル名: 1,
  背景色:     2,
  文字色:     3,
  表示順:     4,
};

function genreRowToObject(row) {
  return {
    ジャンルID: row[GENRE_COL.ジャンルID],
    ジャンル名: row[GENRE_COL.ジャンル名],
    背景色:     row[GENRE_COL.背景色],
    文字色:     row[GENRE_COL.文字色],
    表示順:     Number(row[GENRE_COL.表示順]) || 99,
  };
}

function getGenreSheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GENRE_SHEET_NAME);
}

// 全ジャンル取得（表示順ソート済み・「その他」は末尾保証）
function getGenres() {
  const sheet = getGenreSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const genres = rows
    .filter(r => r[GENRE_COL.ジャンルID] !== '')
    .map(genreRowToObject)
    .sort((a, b) => a.表示順 - b.表示順);

  // 「その他」を末尾に移動
  const others = genres.filter(g => g.ジャンル名 === 'その他');
  const rest   = genres.filter(g => g.ジャンル名 !== 'その他');
  return [...rest, ...others];
}

// ジャンル追加（管理者用）
function addGenre(body) {
  const sheet = getGenreSheet();
  const newId = body['ジャンルID'];
  if (!newId) throw new Error('ジャンルIDは必須です');

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    if (ids.some(r => r[0] === newId)) {
      throw new Error('ジャンルID「' + newId + '」はすでに存在します');
    }
  }

  const newRow = [
    newId,
    body['ジャンル名'] || '',
    body['背景色']     || '#F1EFE8',
    body['文字色']     || '#444441',
    Number(body['表示順']) || 99,
  ];
  sheet.appendRow(newRow);
  return { ジャンルID: newId };
}

// ジャンル更新（管理者用）
function updateGenre(body) {
  const sheet = getGenreSheet();
  const targetId = body['ジャンルID'];
  if (!targetId) throw new Error('ジャンルIDは必須です');

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error('ジャンルデータが存在しません');

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let rowNum = -1;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === targetId) { rowNum = i + 2; break; }
  }
  if (rowNum === -1) throw new Error('ジャンルID「' + targetId + '」が見つかりません');

  const updatable = {
    'ジャンル名': GENRE_COL.ジャンル名 + 1,
    '背景色':     GENRE_COL.背景色     + 1,
    '文字色':     GENRE_COL.文字色     + 1,
    '表示順':     GENRE_COL.表示順     + 1,
  };

  Object.keys(body).forEach(key => {
    if (key === 'ジャンルID') return;
    if (updatable[key]) sheet.getRange(rowNum, updatable[key]).setValue(body[key]);
  });

  return { ジャンルID: targetId };
}

// ジャンル削除（管理者用）
function deleteGenre(id) {
  const sheet = getGenreSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error('ジャンルデータが存在しません');

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let rowNum = -1;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) { rowNum = i + 2; break; }
  }
  if (rowNum === -1) throw new Error('ジャンルID「' + id + '」が見つかりません');

  sheet.deleteRow(rowNum);
  return { ジャンルID: id };
}
