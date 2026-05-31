// ===== メタ攻略シート =====

const META_SHEET_NAME  = 'メタ攻略';
const SPREADSHEET_ID   = '1IamYdl_r3RinmeG7srFSf5496F9vnj_05rjWFCdDo4g';

// 列インデックス（0始まり・A列が0）
const COL = {
  ID:             0,
  投稿者名:       1,
  国:             2,
  地域:           3,
  スコープ:       4,
  ジャンル:       5,
  メタ知識:       6,
  補足:           7,
  参考SVリンク:   8,
  参考サイト:     9,
  画像URL:        10,
  画像クレジット: 11,
  監修者ID:       12,
  Trivia用テキスト: 13,
  確認済:         14,
  出題済:         15,
  公開ステータス: 16,
  監修者へのメモ: 17,
  備考:           18,
  登録日:         19,
};

const TOTAL_COLS = 20; // A〜T列

// 1行分の配列 → オブジェクトに変換
// includeMemo=false のときは「監修者へのメモ」を除外する（閲覧ページ用）
function metaRowToObject(row, includeMemo) {
  const obj = {
    id:               String(row[COL.ID]).padStart(3, '0'),
    投稿者名:         row[COL.投稿者名],
    国:               row[COL.国],
    地域:             row[COL.地域],
    スコープ:         row[COL.スコープ],
    ジャンル:         row[COL.ジャンル],
    メタ知識:         row[COL.メタ知識],
    補足:             row[COL.補足],
    参考SVリンク:     row[COL.参考SVリンク],
    参考サイト:       row[COL.参考サイト],
    画像URL:          row[COL.画像URL],
    画像クレジット:   row[COL.画像クレジット],
    監修者ID:         row[COL.監修者ID],
    Trivia用テキスト: row[COL.Trivia用テキスト],
    確認済:           row[COL.確認済],
    出題済:           row[COL.出題済],
    公開ステータス:   row[COL.公開ステータス],
    備考:             row[COL.備考],
    登録日:           row[COL.登録日],
  };
  if (includeMemo) {
    obj['監修者へのメモ'] = row[COL.監修者へのメモ];
  }
  return obj;
}

// シートを取得するヘルパー
function getMetaSheet() {
  return SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(META_SHEET_NAME);
}

// IDで行番号（1始まり）を検索。見つからなければ -1
function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).padStart(3, '0') === String(id).padStart(3, '0')) {
      return i + 2;
    }
  }
  return -1;
}

// 次のIDを自動採番（既存の最大ID + 1、3桁ゼロ埋め）
function generateNextId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return '001';
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
    .map(r => parseInt(r[0]) || 0);
  const maxId = Math.max(...ids);
  return String(maxId + 1).padStart(3, '0');
}

// ===== GET系（純粋なデータを返す・ContentServiceは持たない） =====

// 公開データ取得（閲覧ページ用・メモなし・監修者情報結合）
function getPublicData() {
  const sheet = getMetaSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  const supervisorMap = getSupervisorMapById();

  return rows
    .filter(r => r[COL.公開ステータス] === '公開')
    .map(r => {
      const obj = metaRowToObject(r, false);
      obj.supervisor = supervisorMap[obj.監修者ID] || null;
      return obj;
    });
}

// 全データ取得（管理者用・メモ含む）
function getAllData() {
  const sheet = getMetaSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  return rows
    .filter(r => r[COL.ID] !== '')
    .map(r => metaRowToObject(r, true));
}

// 監修待ちデータ取得（監修者用・メモ含む）
function getPendingData() {
  const sheet = getMetaSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const pendingStatuses = ['監修待ち', '差し戻し', '再確認待ち'];
  const rows = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  return rows
    .filter(r => pendingStatuses.includes(r[COL.公開ステータス]))
    .map(r => metaRowToObject(r, true));
}

// ===== POST系（純粋なデータを返す・ContentServiceは持たない） =====

// 新規登録
function registerData(body) {
  const sheet = getMetaSheet();
  const newId = generateNextId(sheet);

  const newRow = new Array(TOTAL_COLS).fill('');
  newRow[COL.ID]              = newId;
  newRow[COL.投稿者名]        = body['投稿者名']        || '';
  newRow[COL.国]              = body['国']              || '';
  newRow[COL.地域]            = body['地域']            || '';
  newRow[COL.スコープ]        = body['スコープ']        || '';
  newRow[COL.ジャンル]        = body['ジャンル']        || '';
  newRow[COL.メタ知識]        = body['メタ知識']        || '';
  newRow[COL.補足]            = body['補足']            || '';
  newRow[COL.参考SVリンク]    = body['参考SVリンク']    || '';
  newRow[COL.参考サイト]      = body['参考サイト']      || '';
  newRow[COL.画像URL]         = body['画像URL']         || '';
  newRow[COL.画像クレジット]  = body['画像クレジット']  || '';
  newRow[COL.監修者ID]        = '';
  newRow[COL.確認済]          = false;
  newRow[COL.出題済]          = false;
  newRow[COL.公開ステータス]  = '監修待ち';
  newRow[COL.監修者へのメモ]  = body['監修者へのメモ']  || '';
  newRow[COL.登録日]          = today();

  sheet.appendRow(newRow);
  return { id: newId };
}

// ステータス更新（監修者用）
function updateStatus(id, status, supervisorId) {
  const sheet = getMetaSheet();
  const rowNum = findRowById(sheet, id);
  if (rowNum === -1) throw new Error('ID not found: ' + id);

  sheet.getRange(rowNum, COL.公開ステータス + 1).setValue(status);
  if (supervisorId) {
    sheet.getRange(rowNum, COL.監修者ID + 1).setValue(supervisorId);
  }
  return { id: id, status: status };
}

// データ編集（監修者・管理者用）
function updateData(id, body) {
  const sheet = getMetaSheet();
  const rowNum = findRowById(sheet, id);
  if (rowNum === -1) throw new Error('ID not found: ' + id);

  const updatableFields = {
    '投稿者名':         COL.投稿者名,
    '国':               COL.国,
    '地域':             COL.地域,
    'スコープ':         COL.スコープ,
    'ジャンル':         COL.ジャンル,
    'メタ知識':         COL.メタ知識,
    '補足':             COL.補足,
    '参考SVリンク':     COL.参考SVリンク,
    '参考サイト':       COL.参考サイト,
    '画像URL':          COL.画像URL,
    '画像クレジット':   COL.画像クレジット,
    '監修者ID':         COL.監修者ID,
    'Trivia用テキスト': COL.Trivia用テキスト,
    '確認済':           COL.確認済,
    '出題済':           COL.出題済,
    '公開ステータス':   COL.公開ステータス,
    '監修者へのメモ':   COL.監修者へのメモ,
    '備考':             COL.備考,
  };

  Object.keys(body).forEach(key => {
    if (key === 'id') return;
    if (updatableFields[key] !== undefined) {
      sheet.getRange(rowNum, updatableFields[key] + 1).setValue(body[key]);
    }
  });

  return { id: id };
}

// ===== マイページ用（認証不要） =====

// 投稿者名で自分の投稿を取得（監修者へのメモは含めない）
function getMyData(name) {
  if (!name) throw new Error('投稿者名が指定されていません');
  const sheet = getMetaSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  return rows
    .filter(r => r[COL.投稿者名] === name && r[COL.ID] !== '')
    .map(r => metaRowToObject(r, false)); // メモ除外
}

// 投稿を修正して再送信（投稿者名で照合・ステータスを監修待ちに戻す）
function updateMyData(name, id, body) {
  if (!name) throw new Error('投稿者名が指定されていません');
  const sheet = getMetaSheet();
  const rowNum = findRowById(sheet, id);
  if (rowNum === -1) throw new Error('ID not found: ' + id);

  // 投稿者名の一致確認（なりすまし防止）
  const actualName = sheet.getRange(rowNum, COL.投稿者名 + 1).getValue();
  if (actualName !== name) throw new Error('投稿者名が一致しません');

  const updatableFields = {
    '国':             COL.国,
    '地域':           COL.地域,
    'スコープ':       COL.スコープ,
    'ジャンル':       COL.ジャンル,
    'メタ知識':       COL.メタ知識,
    '補足':           COL.補足,
    '参考SVリンク':   COL.参考SVリンク,
    '参考サイト':     COL.参考サイト,
    '画像URL':        COL.画像URL,
    '画像クレジット': COL.画像クレジット,
    '監修者へのメモ': COL.監修者へのメモ,
  };

  Object.keys(body).forEach(key => {
    if (key === 'id' || key === 'name') return;
    if (updatableFields[key] !== undefined) {
      sheet.getRange(rowNum, updatableFields[key] + 1).setValue(body[key]);
    }
  });

  // ステータスを「監修待ち」に戻す
  sheet.getRange(rowNum, COL.公開ステータス + 1).setValue('監修待ち');

  return { id: id };
}

// データ削除（管理者用）
function deleteData(id) {
  const sheet = getMetaSheet();
  const rowNum = findRowById(sheet, id);
  if (rowNum === -1) throw new Error('ID not found: ' + id);

  sheet.deleteRow(rowNum);
  return { id: id };
}
