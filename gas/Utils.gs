// ===== トークン検証 =====
// type: 'admin' | 'supervisor'
// supervisorトークンはadminトークンでも通過できる（上位互換）

function verifyToken(token, type) {
  const props = PropertiesService.getScriptProperties();
  const adminToken      = props.getProperty('ADMIN_TOKEN');
  const supervisorToken = props.getProperty('SUPERVISOR_TOKEN');

  if (type === 'admin') {
    return token === adminToken;
  }
  if (type === 'supervisor') {
    return token === supervisorToken || token === adminToken;
  }
  return false;
}

// ===== 日付ユーティリティ =====

function today() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
}
