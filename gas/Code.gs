// ===== メインエントリーポイント =====
//
// 【CORSについて】
// GASはOPTIONSプリフライトを処理できないため doOptions は不要。
// クライアント側のPOSTはContent-Type: text/plain を使うことでプリフライトを回避。
// 全レスポンスはこのファイル内で直接 ContentService を生成し、
// .addHeader('Access-Control-Allow-Origin', '*') を確実に付与する。

function doGet(e) {
  const action = e.parameter.action;
  const token  = e.parameter.token;

  try {
    let data;

    switch (action) {
      case 'getPublic':
        data = getPublicData();
        return respond({ status: 'success', data: data });

      case 'getAll':
        if (!verifyToken(token, 'admin'))
          return respond({ status: 'error', message: 'Unauthorized' });
        data = getAllData();
        return respond({ status: 'success', data: data });

      case 'getPending':
        if (!verifyToken(token, 'supervisor'))
          return respond({ status: 'error', message: 'Unauthorized' });
        data = getPendingData();
        return respond({ status: 'success', data: data });

      case 'getSupervisors':
        if (!verifyToken(token, 'supervisor'))
          return respond({ status: 'error', message: 'Unauthorized' });
        data = getSupervisors();
        return respond({ status: 'success', data: data });

      case 'getGenres':
        // 認証不要：閲覧ページ・登録フォームでも使用
        data = getGenres();
        return respond({ status: 'success', data: data });

      case 'getMyData':
        // 認証不要：投稿者名で自分の投稿を取得
        data = getMyData(e.parameter.name || '');
        return respond({ status: 'success', data: data });

      default:
        return respond({ status: 'error', message: 'Unknown action: ' + action });
    }

  } catch (err) {
    return respond({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  const action = e.parameter.action;
  const token  = e.parameter.token;

  try {
    const body = JSON.parse(e.postData.contents);
    let data;

    switch (action) {
      case 'register':
        data = registerData(body);
        return respond({ status: 'success', data: data });

      case 'updateStatus':
        if (!verifyToken(token, 'supervisor'))
          return respond({ status: 'error', message: 'Unauthorized' });
        data = updateStatus(body.id, body.status, body.supervisorId);
        return respond({ status: 'success', data: data });

      case 'update':
        if (!verifyToken(token, 'supervisor'))
          return respond({ status: 'error', message: 'Unauthorized' });
        data = updateData(body.id, body);
        return respond({ status: 'success', data: data });

      case 'delete':
        if (!verifyToken(token, 'admin'))
          return respond({ status: 'error', message: 'Unauthorized' });
        data = deleteData(body.id);
        return respond({ status: 'success', data: data });

      case 'addSupervisor':
        if (!verifyToken(token, 'admin'))
          return respond({ status: 'error', message: 'Unauthorized' });
        data = addSupervisor(body);
        return respond({ status: 'success', data: data });

      case 'updateSupervisor':
        if (!verifyToken(token, 'supervisor'))
          return respond({ status: 'error', message: 'Unauthorized' });
        data = updateSupervisor(body);
        return respond({ status: 'success', data: data });

      case 'updateMyData':
        // 認証不要：投稿者名で照合して修正・監修待ちに戻す
        data = updateMyData(body.name, body.id, body);
        return respond({ status: 'success', data: data });

      case 'addGenre':
        if (!verifyToken(token, 'admin'))
          return respond({ status: 'error', message: 'Unauthorized' });
        data = addGenre(body);
        return respond({ status: 'success', data: data });

      case 'updateGenre':
        if (!verifyToken(token, 'admin'))
          return respond({ status: 'error', message: 'Unauthorized' });
        data = updateGenre(body);
        return respond({ status: 'success', data: data });

      case 'deleteGenre':
        if (!verifyToken(token, 'admin'))
          return respond({ status: 'error', message: 'Unauthorized' });
        data = deleteGenre(body.id);
        return respond({ status: 'success', data: data });

      default:
        return respond({ status: 'error', message: 'Unknown action: ' + action });
    }

  } catch (err) {
    return respond({ status: 'error', message: err.toString() });
  }
}

// ===== レスポンス生成 =====
// addHeader() はGASのTextOutputに存在しない。
// デプロイ設定「アクセス：全員」によりGASが自動でCORSヘッダーを付与する。
function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
