// ===== 監修者マスター =====

const SUPERVISOR_SHEET_NAME = '監修者マスター';

// 列インデックス（0始まり）
const SUP_COL = {
  監修者ID:           0,
  名前:               1,
  GeoGuessrレート:    2,
  得意分野:           3,
  一言プロフィール:   4,
  GeoGuessrプロフURL: 5,
};

// 1行分の配列 → オブジェクトに変換
function supervisorRowToObject(row) {
  return {
    監修者ID:            row[SUP_COL.監修者ID],
    名前:                row[SUP_COL.名前],
    GeoGuessrレート:     row[SUP_COL.GeoGuessrレート],
    得意分野:            row[SUP_COL.得意分野],
    一言プロフィール:    row[SUP_COL.一言プロフィール],
    GeoGuessrプロフURL:  row[SUP_COL.GeoGuessrプロフURL],
  };
}

// 全監修者を取得（純粋な配列を返す・ContentServiceは持たない）
function getSupervisors() {
  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(SUPERVISOR_SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  return rows
    .filter(r => r[SUP_COL.監修者ID] !== '')
    .map(supervisorRowToObject);
}

// 監修者を新規追加（管理者用）
function addSupervisor(body) {
  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(SUPERVISOR_SHEET_NAME);

  const newId = body['監修者ID'];
  if (!newId) throw new Error('監修者IDは必須です');

  // 重複チェック
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    if (ids.some(r => r[0] === newId)) {
      throw new Error('監修者ID「' + newId + '」はすでに存在します');
    }
  }

  const newRow = [
    newId,
    body['名前']               || '',
    body['GeoGuessrレート']    || '',
    body['得意分野']           || '',
    body['一言プロフィール']   || '',
    body['GeoGuessrプロフURL'] || '',
  ];
  sheet.appendRow(newRow);
  return { 監修者ID: newId };
}

// 監修者情報を更新（管理者用）
function updateSupervisor(body) {
  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(SUPERVISOR_SHEET_NAME);

  const targetId = body['監修者ID'];
  if (!targetId) throw new Error('監修者IDは必須です');

  // 対象行を検索
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error('監修者データが存在しません');

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let rowNum = -1;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === targetId) { rowNum = i + 2; break; }
  }
  if (rowNum === -1) throw new Error('監修者ID「' + targetId + '」が見つかりません');

  // 更新可能なフィールドのマップ
  const updatable = {
    '名前':               SUP_COL.名前               + 1,
    'GeoGuessrレート':    SUP_COL.GeoGuessrレート    + 1,
    '得意分野':           SUP_COL.得意分野           + 1,
    '一言プロフィール':   SUP_COL.一言プロフィール   + 1,
    'GeoGuessrプロフURL': SUP_COL.GeoGuessrプロフURL + 1,
  };

  Object.keys(body).forEach(key => {
    if (key === '監修者ID') return;
    if (updatable[key]) {
      sheet.getRange(rowNum, updatable[key]).setValue(body[key]);
    }
  });

  return { 監修者ID: targetId };
}

// 監修者IDをキーにしたマップを返す（getPublicData内での結合用）
function getSupervisorMapById() {
  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(SUPERVISOR_SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return {};

  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const map = {};
  rows.forEach(row => {
    const id = row[SUP_COL.監修者ID];
    if (id) map[id] = supervisorRowToObject(row);
  });
  return map;
}
