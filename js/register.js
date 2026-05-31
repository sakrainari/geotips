// ===== ジャンルドロップダウンを動的に生成 =====
(async () => {
  try {
    const genres = await fetchGenres();
    const sel = document.getElementById('genre');
    // 既存の静的オプションをクリア（プレースホルダー以外）
    sel.innerHTML = '<option value="">選択してください</option>';
    genres.forEach(g => {
      const opt = document.createElement('option');
      opt.value       = g.ジャンル名;
      opt.textContent = g.ジャンル名;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.warn('ジャンル取得失敗（静的オプションを使用）:', e.message);
  }
})();

// ===== 画像プレビュー =====
document.getElementById('image_url').addEventListener('input', function() {
  const url = this.value.trim();
  const img = document.getElementById('image-preview');
  const err = document.getElementById('image-error');

  if (!url) {
    img.classList.remove('visible');
    err.classList.remove('visible');
    return;
  }

  img.src = url;
  img.classList.add('visible');
  err.classList.remove('visible');

  // 読み込み失敗時
  img.onerror = () => {
    img.classList.remove('visible');
    err.classList.add('visible');
  };
  img.onload = () => {
    err.classList.remove('visible');
  };
});

// ===== バリデーション =====
function validateForm() {
  let isValid = true;

  // 必須テキスト・テキストエリア・セレクト
  const requiredFields = [
    { id: 'poster_name',  errId: 'err-poster_name' },
    { id: 'country',      errId: 'err-country' },
    { id: 'genre',        errId: 'err-genre' },
    { id: 'meta',         errId: 'err-meta' },
  ];

  requiredFields.forEach(({ id, errId }) => {
    const el  = document.getElementById(id);
    const err = document.getElementById(errId);
    if (!el.value.trim()) {
      el.classList.add('error');
      err.classList.add('visible');
      isValid = false;
    } else {
      el.classList.remove('error');
      err.classList.remove('visible');
    }
  });

  // スコープ（ラジオ）
  const scopeChecked = document.querySelector('input[name="scope"]:checked');
  const errScope = document.getElementById('err-scope');
  if (!scopeChecked) {
    errScope.classList.add('visible');
    isValid = false;
  } else {
    errScope.classList.remove('visible');
  }

  // URLフィールド（任意・入力ありの場合のみチェック）
  const urlFields = [
    { id: 'sv_url',      errId: 'err-sv_url' },
    { id: 'ref_url',     errId: 'err-ref_url' },
    { id: 'image_url',   errId: 'err-image_url' },
  ];

  urlFields.forEach(({ id, errId }) => {
    const el  = document.getElementById(id);
    const err = document.getElementById(errId);
    const val = el.value.trim();
    if (val && !/^https?:\/\//i.test(val)) {
      el.classList.add('error');
      err.classList.add('visible');
      isValid = false;
    } else {
      el.classList.remove('error');
      err.classList.remove('visible');
    }
  });

  return isValid;
}

// ===== 送信処理 =====
// GASと繋ぐときはこの関数を書き換える
async function submitToGAS(data) {
  // TODO: const GAS_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
  // await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(data) });
  console.log('[Geotips] 送信データ:', data);
}

document.getElementById('register-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  if (!validateForm()) return;

  const data = {
    poster_name:    document.getElementById('poster_name').value.trim(),
    country:        document.getElementById('country').value.trim(),
    region:         document.getElementById('region').value.trim(),
    scope:          document.querySelector('input[name="scope"]:checked').value,
    genre:          document.getElementById('genre').value,
    meta:           document.getElementById('meta').value.trim(),
    supplement:     document.getElementById('supplement').value.trim(),
    sv_url:         document.getElementById('sv_url').value.trim(),
    ref_url:        document.getElementById('ref_url').value.trim(),
    image_url:      document.getElementById('image_url').value.trim(),
    image_credit:   document.getElementById('image_credit').value.trim(),
    memo:           document.getElementById('memo').value.trim(),
    submitted_at:   new Date().toISOString(),
  };

  await submitToGAS(data);

  // 送信完了メッセージを表示（フォームはリセットしない）
  const msg = document.getElementById('submit-message');
  msg.classList.add('visible');
  msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
