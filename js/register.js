// ===== ジャンルドロップダウンを動的に生成 =====
(async () => {
  try {
    const genres = await fetchGenres();
    const sel = document.getElementById('genre');
    // 複数選択（multiple）なのでプレースホルダーは置かず、全オプションを生成
    sel.innerHTML = '';
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

  // ジャンル（複数選択・1つ以上必須）
  const genreEl  = document.getElementById('genre');
  const genreErr = document.getElementById('err-genre');
  if (getSelectedGenres(genreEl).length === 0) {
    genreEl.classList.add('error');
    genreErr.classList.add('visible');
    isValid = false;
  } else {
    genreEl.classList.remove('error');
    genreErr.classList.remove('visible');
  }

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

document.getElementById('register-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  if (!validateForm()) return;

  const submitBtn = this.querySelector('button[type="submit"]');
  const msg = document.getElementById('submit-message');
  const data = {
    '投稿者名':        document.getElementById('poster_name').value.trim(),
    '国':              document.getElementById('country').value.trim(),
    '地域':            document.getElementById('region').value.trim(),
    'スコープ':        document.querySelector('input[name="scope"]:checked').value,
    'ジャンル':        joinGenres(getSelectedGenres(document.getElementById('genre'))),
    'メタ知識':        document.getElementById('meta').value.trim(),
    '補足':            document.getElementById('supplement').value.trim(),
    '参考SVリンク':    document.getElementById('sv_url').value.trim(),
    '参考サイト':      document.getElementById('ref_url').value.trim(),
    '画像URL':         document.getElementById('image_url').value.trim(),
    '画像クレジット':  document.getElementById('image_credit').value.trim(),
    '監修者へのメモ':  document.getElementById('memo').value.trim(),
  };

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中...';
  }
  msg.classList.remove('visible');
  msg.textContent = '';

  try {
    const result = await submitRegistration(data);
    if (result.status !== 'success') {
      throw new Error(result.message || '送信に失敗しました');
    }

    msg.textContent = `送信しました。受付ID: ${result.data?.id || '---'}。監修ページで確認できる状態です。`;
    msg.classList.add('visible');
    msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    console.error('[Geotips] 登録失敗:', error);
    msg.textContent = `送信に失敗しました: ${error.message}`;
    msg.classList.add('visible');
    msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '送信する';
    }
  }
});
