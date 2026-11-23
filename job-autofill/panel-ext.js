/* Extension glue for the Resume Analytics panel: loads resume + job from the extension, caches analysis, auto-replaces the resume. */
(function () {
  var tabId = +new URLSearchParams(location.search).get('tab') || null;
  var fixed = !!tabId;
  var busy = function () { return $('bs').disabled; };
  async function curTab() { if (tabId) return; var t = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]; tabId = t ? t.id : null; }
  var DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  var settings = Object.assign({}, JN.DEFAULT_SETTINGS);
  window.PX = {};

  function b64ToBuf(b64) { var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  function bufToB64(buf) { var u = new Uint8Array(buf), s = '', ch = 0x8000; for (var i = 0; i < u.length; i += ch) s += String.fromCharCode.apply(null, u.subarray(i, i + ch)); return btoa(s); }
  function blobToB64(blob) { return blob.arrayBuffer().then(bufToB64); }
  function showTab(t) { document.querySelectorAll('.tabs button').forEach(function (b) { if (b.dataset.t === t) b.click(); }); }
  function setResumeLabel() { $('rname').textContent = S.buf ? S.fname : 'No resume yet'; }

  async function loadJD() {
    if (!tabId) return;
    try {
      var jd = await chrome.tabs.sendMessage(tabId, { type: 'jn:getJD' });
      if (jd && jd.text) {
        $('jd').value = jd.text;
        var wc = (jd.text.match(/\S+/g) || []).length;
        $('jdsum').textContent = wc + ' words · ' + (jd.source === 'selection' ? 'selected text' : jd.source === 'cache' ? 'saved from job page' : 'from page'); $('jdsum').className = 'pill ok';
        $('jobline').textContent = (jd.title || 'This page') + (jd.source === 'selection' ? ' (selected text)' : '');
        chips();
        return jd;
      }
    } catch (e) { $('jobline').textContent = 'Reload the job page, then reopen this panel.'; }
  }

  async function tryCache() {
    var d = await chrome.storage.local.get(['analysis', 'resume']);
    if (!d.resume || !$('jd').value.trim()) return;
    var key = JN.hash($('jd').value) + '-' + JN.hash(d.resume.b64.slice(0, 3000) + d.resume.b64.length);
    var hit = d.analysis && d.analysis[key];
    if (!hit) return;
    S.an = hit.an; S.cachedOnly = true; S.ev = {}; S.evSig = ''; S.evInfo = '';
    renderAn(); $('br').disabled = false; $('br').textContent = S.an.aligned === 'weak' ? 'Rewrite anyway' : 'Rewrite my resume';
    $('inp').open = false;
  }

  async function resolveTab() {
    if (tabId) return;
    try { var t = await chrome.tabs.query({ active: true, currentWindow: true }); tabId = t[0] && t[0].id; } catch (e) {}
  }
  async function refreshJob() {
    if (busy()) return;
    S.an = null; S.cachedOnly = false; $('an').innerHTML = ''; $('br').disabled = true;
    await loadJD(); await tryCache();
  }
  if (!fixed) chrome.tabs.onActivated.addListener(function (i) { tabId = i.tabId; setTimeout(refreshJob, 300); });
  chrome.tabs.onUpdated.addListener(function (id, ch) { if (id === tabId && ch.status === 'complete') setTimeout(refreshJob, 800); });

  // Gemini key is entered by each user in Jobnaut options and mirrored here for the AI shim (same extension origin).
  function mirrorAI(ai) {
    try {
      ai = ai || {};
      if (ai.geminiKey) localStorage.setItem('ro_gemini_key', ai.geminiKey); else localStorage.removeItem('ro_gemini_key');
      if (ai.geminiModel) localStorage.setItem('ro_gemini_model', ai.geminiModel); else localStorage.removeItem('ro_gemini_model');
    } catch (e) {}
  }
  chrome.storage.onChanged.addListener(function (ch, area) { if (area === 'local' && ch.ai) mirrorAI(ch.ai.newValue); });

  async function init() {
    await resolveTab();
    var d = await chrome.storage.local.get(['resume', 'resumeExtras', 'settings', 'ai']);
    mirrorAI(d.ai);
    settings = Object.assign({}, JN.DEFAULT_SETTINGS, d.settings || {});
    await curTab();
    if (d.resume) { try { S.buf = b64ToBuf(d.resume.b64); S.fname = d.resume.name; await loadResume(); } catch (e) { S.buf = null; } }
    var ex = d.resumeExtras || {};
    $('up').value = ex.up || ''; $('pj').value = ex.pj || '';
    setResumeLabel(); chips();
    await loadJD();
    await tryCache();
  }

  // persist inputs
  var saveEx = function () { chrome.storage.local.set({ resumeExtras: { up: $('up').value, pj: $('pj').value } }); };
  $('up').addEventListener('input', saveEx); $('pj').addEventListener('input', saveEx);
  $('fu').addEventListener('change', function () { setTimeout(saveEx, 400); });
  $('fp').addEventListener('change', function () { setTimeout(saveEx, 400); });

  // replace resume
  $('rrep').onclick = function () { $('fr').click(); };
  $('fr').addEventListener('change', async function (e) {
    var f = e.target.files[0]; if (!f) return;
    var b64 = bufToB64(await f.arrayBuffer());
    await chrome.storage.local.set({ resume: { name: f.name, b64: b64, size: f.size, ts: Date.now() } });
    S.an = null; S.cachedOnly = false; setResumeLabel();
  });
  $('cfgbtn').onclick = function () { chrome.runtime.openOptionsPage(); };
  $('rj').onclick = async function () { var jd = await loadJD(); if (jd) { S.an = null; S.cachedOnly = false; await tryCache(); } };

  async function capture(btn) {
    var old = S.dl, out = null;
    S.dl = { save: async function (o) { out = o; } };
    try { await btn.onclick(); } finally { S.dl = old; }
    return out;
  }

  async function sendToPage(files) {
    if (!tabId) return 0;
    try {
      var r = await chrome.tabs.sendMessage(tabId, { type: 'jn:attach', files: files, format: settings.resumeFormat });
      return (r && r.attached) || 0;
    } catch (e) { return 0; }
  }


  // ---- docked-panel controls (this page is an iframe inside the job tab) ----
  var tall = false;
  function toParent(m) { try { parent.postMessage(Object.assign({ jn: 'lab' }, m), '*'); } catch (e) {} }
  $('cl').onclick = function () { toParent({ act: 'close' }); };
  $('sz').onclick = function () { tall = !tall; toParent({ act: 'size', tall: tall }); };
  PX.afterAnalyse = function () {
    try {
      var a = S.an, bd = {}, miss = [];
      ['skills', 'title', 'hard', 'narr'].forEach(function (k) { var f = a.factors[k]; bd[k] = Math.round(+f.score || 0); });
      ((a.factors.skills && a.factors.skills.items) || []).filter(function (i) { return i.status === 'missing'; }).slice(0, 6).forEach(function (i) { miss.push(String(i.label).replace(/ \(preferred\)$/, '')); });
      toParent({ act: 'score', res: { overall: overall(bd), aligned: a.aligned, role: a.role || '', breakdown: bd, missing: miss } });
    } catch (e) {}
  };
  PX.files = null;
  PX.afterRewrite = async function () {
    $('bar').classList.add('on');
    showTab('res');
    try {
      var dx = await capture($('dd')), pf = await capture($('dp'));
      var files = [];
      if (dx) files.push({ name: dx.filename, type: DOCX, b64: await blobToB64(dx.data) });
      if (pf) files.push({ name: pf.filename, type: 'application/pdf', b64: await blobToB64(pf.data) });
      PX.files = files;
      var jobKey = null;
      try { var u = await chrome.tabs.get(tabId); var L = new URL(u.url); jobKey = L.origin + L.pathname.replace(/\/(apply|application)\/?$/i, '').replace(/\/$/, ''); } catch (e) {}
      await chrome.storage.local.set({ tailored: { jobKey: jobKey, docxB64: files[0] && files[0].b64, docxName: files[0] && files[0].name, pdfB64: files[1] && files[1].b64, pdfName: files[1] && files[1].name, ts: Date.now() } });
      $('ap').disabled = false;
      if (settings.autoReplace) {
        var n = await sendToPage(files);
        $('status').textContent = n ? 'Tailored resume attached to the application.' : 'Rewrite ready. No resume upload field found on the page, use "Use on this application" once it appears.';
      }
    } catch (e) { $('status').innerHTML = '<span class="err">' + esc(e.message || 'Could not prepare files') + '</span>'; }
  };
  $('ap').onclick = async function () {
    if (!PX.files) return;
    var n = await sendToPage(PX.files);
    $('status').textContent = n ? 'Tailored resume attached to the application.' : 'No resume upload field found on the page.';
  };

  init().catch(function (e) { $('status').innerHTML = '<span class="err">' + esc(e.message) + '</span>'; });
})();
