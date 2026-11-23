// Jobnaut content script: autofill engine, learning, resume attach, JD extraction, floating widget.
(() => {
  if (window.__jobnaut) return;
  window.__jobnaut = true;
  const JN = globalThis.JN;
  const norm = JN.norm;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const isTop = window.top === window;

  // ================= storage =================
  async function getStore() {
    const d = await chrome.storage.local.get(["profile", "answers", "settings", "resume", "tailored"]);
    return {
      profile: d.profile || {},
      answers: d.answers || [],
      settings: Object.assign({}, JN.DEFAULT_SETTINGS, d.settings || {}),
      resume: d.resume || null,
      tailored: d.tailored || null
    };
  }

  // ================= DOM helpers =================
  function inHost(el) { return !!(el.closest && el.closest("#jn-host")); }
  function textOf(n) { return n ? clean(n.innerText || n.textContent) : ""; }
  function rectVisible(el) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && (r.width > 0 || r.height > 0);
  }
  function isShown(el) {
    if (rectVisible(el) && getComputedStyle(el).opacity !== "0") return true;
    if (el.type === "radio" || el.type === "checkbox") {
      const lab = (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest("label") || el.parentElement;
      return !!lab && rectVisible(lab);
    }
    return false;
  }
  function fire(el, type, init) {
    el.dispatchEvent(new MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, view: window }, init || {})));
  }
  function realClick(el) {
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((t) => fire(el, t));
  }
  function setNative(el, value) {
    const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function mark(el) {
    el.dataset.jnDone = "1";
    const t = el.type === "radio" || el.type === "checkbox" ? el.closest("label") || el.parentElement || el : el;
    t.style.outline = "2px solid #6366f1";
    t.style.outlineOffset = "1px";
  }

  // ================= question text =================
  function idsText(attr) {
    return (attr || "").split(/\s+/).map((id) => textOf(document.getElementById(id))).filter(Boolean).join(" ");
  }
  function groupQuestion(box) {
    if (!box) return "";
    const legend = box.querySelector("legend");
    if (legend) return textOf(legend);
    const by = idsText(box.getAttribute("aria-labelledby"));
    if (by) return by;
    if (box.getAttribute("aria-label")) return box.getAttribute("aria-label");
    let p = box;
    for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
      const lab = p.querySelector(":scope > label, :scope > legend, :scope > p, :scope > h3, :scope > h4, :scope > span, :scope > div > label");
      if (lab && !lab.querySelector("input, select, textarea") && textOf(lab).length > 2) return textOf(lab);
      let prev = p.previousElementSibling;
      if (prev && textOf(prev) && textOf(prev).length < 300 && !prev.querySelector("input, select, textarea")) return textOf(prev);
    }
    return "";
  }
  function getQuestion(el) {
    if (el._jnGroup) return groupQuestion(el._jnGroup);
    if (el.type === "radio" || el.type === "checkbox") {
      const g = el.closest("fieldset, [role=radiogroup], [role=group]");
      const q = g && groupQuestion(g);
      if (q) return q;
      return groupQuestion(el.closest("div, li"));
    }
    const parts = [];
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) parts.push(textOf(l));
    }
    const wrap = el.closest("label");
    if (wrap) parts.push(textOf(wrap));
    const by = idsText(el.getAttribute("aria-labelledby"));
    if (by) parts.push(by);
    if (el.getAttribute("aria-label")) parts.push(el.getAttribute("aria-label"));
    if (!parts.join("").trim()) parts.push(groupQuestion(el.closest("div, li, td")));
    if (!parts.join("").trim()) {
      if (el.placeholder) parts.push(el.placeholder);
      if (el.name) parts.push(el.name.replace(/[_\-\[\]]+/g, " "));
    }
    return clean(parts.find((p) => p && p.trim()) || "").replace(/\s*\*\s*$/, "").slice(0, 300);
  }
  function optionLabel(el) {
    const l = (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest("label");
    return clean(textOf(l) || el.getAttribute("aria-label") || el.value);
  }

  // ================= classification =================
  const HEAD_SEL = "h1,h2,h3,h4,h5,h6,legend,[role=heading]";
  function typeFromText(t) {
    t = (t || "").toLowerCase();
    if (/education|academic/.test(t)) return "edu";
    if (/employment|work experience|work history|experience|job history/.test(t)) return "exp";
    return null;
  }
  function sectionType(el) {
    let p = el;
    for (let i = 0; i < 10 && p; i++, p = p.parentElement) {
      const auto = (p.getAttribute && (p.getAttribute("data-automation-id") || "")) || "";
      if (/educationSection|education-/i.test(auto)) return "edu";
      if (/workExperienceSection|workExperience|employment/i.test(auto)) return "exp";
    }
    // nearest preceding heading among the siblings of the element or its ancestors
    p = el;
    for (let i = 0; i < 8 && p; i++, p = p.parentElement) {
      let s = p.previousElementSibling;
      for (let n = 0; s && n < 8; n++, s = s.previousElementSibling) {
        const h = s.matches && s.matches(HEAD_SEL) ? s : s.querySelector && s.querySelector(HEAD_SEL);
        if (h) { const t = typeFromText(textOf(h)); return t; }
      }
      const own = p.querySelector && p.querySelector(":scope > " + HEAD_SEL.split(",").join(", :scope > "));
      if (own && !own.contains(el)) { const t = typeFromText(textOf(own)); if (t) return t; }
    }
    return null;
  }

  function autoIds(el) {
    const out = [el.id, el.name, el.getAttribute("data-automation-id")];
    let p = el.parentElement;
    for (let i = 0; i < 3 && p; i++, p = p.parentElement) out.push(p.getAttribute("data-automation-id"));
    return out.filter(Boolean);
  }

  function dateRole(nq, el, type) {
    if (!type) return null;
    const ids = autoIds(el).join(" ");
    const hay = nq + " " + ids.toLowerCase();
    if (!/\b(date|month|year|from|to|start|end|period|graduat|attended|until|through|since|completion|finish)\b|datesection/i.test(hay)) return null;
    const isStart = /\b(start|from|begin|since|first ?year|joined)\b|startdate|firstyear/i.test(hay);
    const isEnd = /\b(end|until|through|graduat|last ?year|completion|finish|to)\b|enddate|lastyear/i.test(hay);
    if (!isStart && !isEnd) return null;
    let part = null;
    if (/datesectionmonth|\bmonth\b/i.test(hay)) part = "month";
    else if (/datesectionyear|\byear\b/i.test(hay)) part = "year";
    return { key: type + "." + (isStart ? "start" : "end") + (part ? "." + part : "") };
  }

  function classify(el, q, st) {
    // 1. explicit ids / names
    const cands = autoIds(el);
    for (const c of cands) {
      for (const [re, key, gi] of JN.ATTR_RULES) {
        const m = re.exec(c);
        if (m) return { key, idx: gi ? +m[gi] : undefined };
      }
    }
    const nq = norm(q);
    const st0 = sectionType(el) || st.cur.type;
    const dr = dateRole(nq, el, st0);
    if (dr) return dr;
    if (nq) {
      for (const r of JN.RULES) {
        if (r.ctx && r.ctx !== st0) continue;
        if (r.re.test(nq) && !(r.not && r.not.test(nq))) return { key: r.key, optionsOnly: r.optionsOnly };
      }
    }
    const ac = (el.getAttribute("autocomplete") || "").split(" ").pop();
    if (JN.AC[ac]) return { key: JN.AC[ac] };
    return null;
  }

  // ================= value resolution =================
  function profileValue(res, S, st) {
    const p = S.profile;
    let key = res.key;
    const m = /^(exp|edu)\.(\w+)(?:\.(\w+))?$/.exec(key);
    if (m) {
      const type = m[1], field = m[2], part = res.part || m[3];
      const list = (type === "exp" ? p.experience : p.education) || [];
      let idx = res.idx;
      if (idx == null) {
        if (st.cur.type !== type || st.cur.seen.has(field + (part || ""))) {
          st.counter[type]++;
          st.cur = { type, seen: new Set() };
        }
        st.cur.seen.add(field + (part || ""));
        idx = st.counter[type];
      }
      const entry = list[idx];
      if (!entry) return { skip: true };
      if (field === "current") return { bool: !!entry.current };
      if (field === "start" || field === "end") {
        if (field === "end" && entry.current) return { value: "", part, ym: "" };
        return { ym: entry[field] || "", part };
      }
      return { value: entry[field] || "" };
    }
    if (key === "fullName") return { value: [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ") };
    if (key === "currentCompany") return { value: p.currentCompany || ((p.experience || [])[0] || {}).company || "" };
    if (key === "currentTitle") return { value: p.currentTitle || ((p.experience || [])[0] || {}).title || "" };
    if (key === "location") return { value: [p.city, p.state, p.country].filter(Boolean).join(", ") };
    if (key === "summary" && !p.summary) return { value: ((p.experience || [])[0] || {}).description || "" };
    return { value: p[key] || "", field: JN.FIELD[key] };
  }

  function learnedValue(S, q) {
    const n = norm(q);
    let best = null, bs = 0;
    for (const a of S.answers) {
      const s = a.q === n ? 1 : JN.similarity(a.q, n);
      if (s > bs) { best = a; bs = s; }
    }
    return bs >= 0.75 ? best : null;
  }

  // ================= option helpers =================
  const OPT_SEL = '[role="option"],[data-automation-id="promptOption"],[role="listbox"] li,.select__option,.dropdown-results li,.pac-item,[class*="menu"] [class*="option"]';
  function visibleOptions() {
    const seen = new Set();
    return [...document.querySelectorAll(OPT_SEL)]
      .filter((o) => !inHost(o) && rectVisible(o) && textOf(o) && !seen.has(o) && seen.add(o))
      .map((o) => ({ el: o, text: textOf(o) }));
  }
  function selectOpts(sel) {
    return [...sel.options].map((o) => ({ el: o, text: clean(o.text), value: o.value }));
  }
  const monthMatch = (opts, mm) => {
    const i = +mm;
    return opts.find((o) => JN.norm(o.text) === JN.norm(JN.MONTHS[i - 1])) || opts.find((o) => JN.norm(o.text).startsWith(JN.norm(JN.MONTHS[i - 1]).slice(0, 3))) || opts.find((o) => +o.text === i || +o.value === i);
  };

  // ================= fillers =================
  async function fillTextLike(el, value) {
    el.focus();
    setNative(el, value);
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }

  async function fillSelect(el, value, intent, ymPart) {
    const opts = selectOpts(el);
    let pick;
    if (ymPart === "month") pick = monthMatch(opts, value);
    else pick = JN.pickOption(opts, value, intent) || (ymPart === "year" ? opts.find((o) => o.text.trim() === String(value)) : null);
    if (!pick) return false;
    setNative(el, pick.value);
    return true;
  }

  async function fillCombo(el, value, intent, firstOk) {
    const input = el.tagName === "INPUT" ? el : el.querySelector("input");
    el.focus && el.focus();
    realClick(el);
    await sleep(200);
    let list = visibleOptions();
    if ((!list.length || list.length > 12) && input) {
      setNative(input, value);
      await sleep(600);
      list = visibleOptions();
      if (!list.length) {
        setNative(input, String(value).split(/[ ,]/)[0]);
        await sleep(700);
        list = visibleOptions();
      }
    }
    let pick = JN.pickOption(list, value, intent);
    if (!pick && firstOk && list.length) pick = list[0];
    if (pick) {
      realClick(pick.el);
      await sleep(150);
      return true;
    }
    if (input) { setNative(input, ""); }
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  }

  function fillRadio(group, value, intent) {
    const opts = group.map((r) => ({ el: r, text: optionLabel(r) }));
    const pick = JN.pickOption(opts, value, intent);
    if (!pick) return false;
    if (!pick.el.checked) pick.el.click();
    mark(pick.el);
    return true;
  }

  function fillCheckGroup(group, value) {
    const wanted = String(value).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    let n = 0;
    group.forEach((c) => {
      const t = optionLabel(c);
      const want = wanted.some((w) => norm(w) === norm(t) || norm(t).includes(norm(w)) || norm(w).includes(norm(t)));
      if (want && !c.checked) { c.click(); n++; mark(c); }
    });
    return n > 0;
  }

  function fillBtnGroup(btns, value) {
    const pick = JN.pickOption(btns.map((b) => ({ el: b, text: textOf(b) })), value, true);
    if (!pick) return false;
    pick.el.click();
    return true;
  }

  // ================= collect controls =================
  function collect() {
    const items = [];
    const doneGroups = new Set();
    const all = document.querySelectorAll('input, textarea, select, [role="combobox"], button[aria-haspopup="listbox"]');
    all.forEach((el) => {
      if (inHost(el)) return;
      const tag = el.tagName;
      const type = (el.type || "").toLowerCase();
      if (tag === "INPUT" && ["hidden", "submit", "button", "image", "reset", "file", "password", "search"].includes(type)) return;
      if (el.disabled || el.readOnly) return;
      if (el.closest('[role="combobox"]') && el.closest('[role="combobox"]') !== el && tag === "INPUT" && el.getAttribute("role") !== "combobox") return;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && el.querySelector("input[role=combobox]")) return;
      if (!isShown(el)) return;
      const isCombo = el.getAttribute("role") === "combobox" || el.getAttribute("aria-haspopup") === "listbox" || el.getAttribute("aria-autocomplete") === "list";
      if (type === "radio") {
        const key = (el.name || "") + "|" + (el.form ? "f" : "n");
        if (!el.name) { items.push({ el, kind: "radio", group: [el] }); return; }
        if (doneGroups.has(key)) return;
        doneGroups.add(key);
        items.push({ el, kind: "radio", group: [...document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`)].filter((r) => !inHost(r)) });
      } else if (type === "checkbox") {
        const box = el.closest("fieldset, [role=group]");
        const sibs = box ? [...box.querySelectorAll("input[type=checkbox]")] : [];
        if (sibs.length > 1) {
          if (doneGroups.has(box)) return;
          doneGroups.add(box);
          el._jnGroup = box;
          items.push({ el, kind: "checkgroup", group: sibs });
        } else items.push({ el, kind: "checkbox" });
      } else if (tag === "SELECT") items.push({ el, kind: "select" });
      else if (tag === "TEXTAREA") items.push({ el, kind: "text" });
      else if (isCombo) items.push({ el, kind: "combo" });
      else items.push({ el, kind: "text" });
    });
    // Yes/No button groups (Ashby-style)
    document.querySelectorAll("button").forEach((b) => {
      if (inHost(b) || !/^(yes|no)$/i.test(textOf(b)) || !isShown(b)) return;
      const box = b.parentElement;
      if (!box || doneGroups.has(box)) return;
      const btns = [...box.querySelectorAll(":scope > button")];
      if (btns.length < 2 || !btns.every((x) => /^(yes|no)$/i.test(textOf(x)))) return;
      doneGroups.add(box);
      const proxy = { _jnGroup: box.parentElement || box, tagName: "DIV", getAttribute: () => null, closest: () => null };
      items.push({ el: btns[0], kind: "btngroup", group: btns, q: groupQuestion(box.parentElement || box) });
    });
    return items;
  }

  // ================= add-section buttons (Workday / Greenhouse) =================
  async function expandSections(profile) {
    const need = { exp: (profile.experience || []).length, edu: (profile.education || []).length };
    const count = (re) => {
      let n = 0;
      document.querySelectorAll("input, select, textarea").forEach((e) => {
        if (inHost(e) || !isShown(e) || ["hidden", "radio", "checkbox", "file"].includes(e.type)) return;
        if (re.test(norm(getQuestion(e)))) n++;
      });
      return n;
    };
    const probe = {
      exp: () => count(/\b(company|employer)\b/),
      edu: () => count(/\b(school|university|college|institution)\b/)
    };
    const findAdd = (type) => {
      const root = document.querySelector(type === "exp" ? '[data-automation-id="workExperienceSection"]' : '[data-automation-id="educationSection"]');
      const scope = root || document;
      const re = type === "exp" ? /^\+?\s*add( another)?( (work )?(experience|employment|job|position))?$/i : /^\+?\s*add( another)?( education)?$/i;
      const btns = [...scope.querySelectorAll("button, a, [role=button]")].filter((b) => !inHost(b) && re.test(textOf(b)) && rectVisible(b));
      if (root) return btns[btns.length - 1];
      // outside Workday require the button to sit near a matching heading
      return btns.find((b) => {
        let p = b;
        for (let i = 0; i < 5 && p; i++, p = p.parentElement) {
          const h = p.querySelector && p.querySelector(":scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > legend");
          if (h && (type === "exp" ? /employment|experience|work/i : /education/i).test(textOf(h))) return true;
        }
        return false;
      });
    };
    for (const type of ["exp", "edu"]) {
      for (let i = 0; i < 6; i++) {
        const have = probe[type]();
        if (have >= need[type] && have > 0) break;
        const b = findAdd(type);
        if (!b || i >= need[type]) break;
        realClick(b);
        await sleep(700);
      }
    }
  }

  // ================= main autofill =================
  let busy = false;
  async function autofill(opts) {
    if (busy) return { filled: 0, skipped: 0, missing: 0 };
    busy = true;
    try {
      const S = await getStore();
      if (!Object.keys(S.profile).length) { toast("Add your profile first (Jobnaut options)."); return { filled: 0, skipped: 0, missing: 0, empty: true }; }
      await expandSections(S.profile);
      const st = { counter: { exp: -1, edu: -1 }, cur: { type: null, seen: new Set() } };
      const items = collect();
      let filled = 0, skipped = 0, missing = 0;
      for (const it of items) {
        const el = it.el;
        try {
          const q = it.q || getQuestion(el);
          if (!q || JN.isSensitive(q)) continue;
          const res = classify(el, q, st);
          let value = "", pv = null, intent = false, firstOk = false, isBool = false, ym;
          if (res) {
            pv = profileValue(res, S, st);
            if (pv.skip) continue;
            if (pv.bool !== undefined) isBool = true;
            if (pv.ym !== undefined) ym = pv;
            value = pv.value || "";
            intent = !!(pv.field && pv.field.intent) || it.kind === "btngroup";
            if (res.optionsOnly && !["select", "radio", "combo"].includes(it.kind)) continue;
            if (res.key === "location" || res.key === "city") firstOk = true;
          }
          if (!value && !isBool && !ym) {
            const l = learnedValue(S, q);
            if (l) { value = l.answer; intent = /^(yes|no)$/i.test(l.answer); }
          }
          // consent checkboxes
          if (it.kind === "checkbox") {
            if (isBool) {
              if (pv.bool !== el.checked && !el.dataset.jnDone) { el.click(); mark(el); filled++; }
              continue;
            }
            if (S.settings.autoConsent && /\b(agree|acknowledge|consent|certify|confirm|understand|accept|authori[sz]e|privacy)\b/i.test(q) && !el.checked) { el.click(); mark(el); filled++; }
            continue;
          }
          if (ym) {
            const raw = ym.ym;
            if (!raw && it.kind === "text") { skipped++; continue; }
            const part = ym.part;
            if (it.kind === "select") {
              const p = JN.parseYM(raw);
              if (!p) { skipped++; continue; }
              if (await fillSelect(el, part === "month" ? p.m : p.y, false, part)) { mark(el); filled++; } else skipped++;
              continue;
            }
            value = JN.fmtDate(raw, el, part);
            if (!value) { skipped++; continue; }
          }
          if (!value) {
            skipped++;
            if (S.settings.highlightMissing && (el.required || el.getAttribute("aria-required") === "true") && it.kind !== "radio") {
              el.style.outline = "2px dashed #f59e0b";
              missing++;
            }
            continue;
          }
          // skip when already filled
          if (!S.settings.overwrite && !opts?.force) {
            if (it.kind === "text" && el.value && !el.dataset.jnDone) continue;
            if (it.kind === "select" && el.selectedIndex > 0 && !JN.isPlaceholder(el.options[el.selectedIndex].text) && !el.dataset.jnDone) continue;
            if (it.kind === "radio" && it.group.some((r) => r.checked)) continue;
            if (it.kind === "combo" && el.dataset.jnDone) continue;
          }
          let ok = false;
          if (it.kind === "text") ok = await fillTextLike(el, value);
          else if (it.kind === "select") ok = await fillSelect(el, value, intent);
          else if (it.kind === "radio") ok = fillRadio(it.group, value, intent);
          else if (it.kind === "checkgroup") ok = fillCheckGroup(it.group, value);
          else if (it.kind === "btngroup") ok = fillBtnGroup(it.group, value);
          else if (it.kind === "combo") ok = await fillCombo(el, value, intent, firstOk);
          if (ok) { mark(el); filled++; } else skipped++;
        } catch (e) { skipped++; }
      }
      let resumeNote = "";
      if (S.settings.autoResume && !opts?.noResume) {
        const r = await attachStored(S);
        if (r) resumeNote = " + resume";
      }
      toast(`Jobnaut: filled ${filled}${resumeNote}${missing ? `, ${missing} required need you` : skipped ? `, ${skipped} left for you` : ""}`);
      return { filled, skipped, missing };
    } finally { busy = false; }
  }

  // ================= learning =================
  async function learn(q, answer, type) {
    const S = await getStore();
    if (!S.settings.learn) return;
    q = clean(q);
    answer = clean(answer);
    if (!q || !answer || JN.isSensitive(q) || JN.isPlaceholder(answer) || q.length < 4 || answer.length > 2000) return;
    const n = norm(q);
    const fakeSt = { counter: { exp: -1, edu: -1 }, cur: { type: null, seen: new Set() } };
    for (const r of JN.RULES) if (r.re.test(n) && !(r.not && r.not.test(n)) && !r.ctx) return; // covered by the profile form
    const answers = S.answers;
    const i = answers.findIndex((a) => a.q === n || JN.similarity(a.q, n) >= 0.9);
    const entry = { q: n, question: q.slice(0, 300), answer, type: type || "text", host: location.hostname, source: "learned", updated: Date.now() };
    const changed = i < 0 || answers[i].answer !== answer;
    if (i >= 0) answers[i] = Object.assign({}, answers[i], entry, { source: answers[i].source || "learned" });
    else answers.push(entry);
    await chrome.storage.local.set({ answers });
    if (changed) toast("Jobnaut: saved your answer for next time");
  }

  let lastCombo = null;
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (t && t.closest && !inHost(t) && t.closest('[role="combobox"], button[aria-haspopup="listbox"], input[aria-autocomplete]')) lastCombo = t.closest('[role="combobox"], button[aria-haspopup="listbox"]') || t;
  }, true);
  document.addEventListener("pointerdown", (e) => {
    const c = e.target && e.target.closest && e.target.closest('[role="combobox"], button[aria-haspopup="listbox"]');
    if (c && !inHost(c)) lastCombo = c;
  }, true);
  document.addEventListener("click", (e) => {
    if (!e.isTrusted || !lastCombo) return;
    const o = e.target.closest && e.target.closest('[role="option"], [data-automation-id="promptOption"], .select__option');
    if (!o || inHost(o)) return;
    learn(getQuestion(lastCombo.tagName === "INPUT" ? lastCombo : lastCombo), textOf(o), "choice").catch(() => {});
  }, true);

  document.addEventListener("change", (e) => {
    if (!e.isTrusted) return;
    const el = e.target;
    if (!el || inHost(el) || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    const type = (el.type || "").toLowerCase();
    if (["password", "file", "hidden", "submit", "button", "search"].includes(type)) return;
    if (type === "checkbox") {
      const box = el.closest("fieldset, [role=group]");
      const sibs = box ? [...box.querySelectorAll("input[type=checkbox]")] : [];
      if (sibs.length > 1) {
        el._jnGroup = box;
        const ans = sibs.filter((c) => c.checked).map(optionLabel).join(", ");
        if (ans) learn(getQuestion(el), ans, "multi").catch(() => {});
      }
      return;
    }
    let ans;
    if (el.tagName === "SELECT") ans = clean(el.options[el.selectedIndex] && el.options[el.selectedIndex].text);
    else if (type === "radio") ans = optionLabel(el);
    else ans = clean(el.value);
    if (el.getAttribute("role") === "combobox") return; // handled via option click
    learn(getQuestion(el), ans, el.tagName === "SELECT" || type === "radio" ? "choice" : "text").catch(() => {});
  }, true);

  // ================= resume attach =================
  function b64ToFile(b64, name, type) {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new File([u], name, { type });
  }
  function nearText(el) {
    let t = [el.name, el.id, el.accept, el.getAttribute("aria-label"), el.getAttribute("data-automation-id")].join(" ");
    let p = el;
    for (let i = 0; i < 4 && p; i++, p = p.parentElement) t += " " + (p.getAttribute("data-field") || "") + " " + (p.getAttribute("data-qa") || "");
    const lab = (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest("label");
    t += " " + textOf(lab) + " " + groupQuestion(el.closest("div"));
    return t.toLowerCase();
  }
  function findResumeInputs() {
    const inputs = [...document.querySelectorAll("input[type=file]")].filter((i) => !inHost(i) && !i.disabled);
    const good = inputs.filter((i) => { const t = nearText(i); return /resume|\bcv\b|curriculum/.test(t) && !/cover/.test(t.replace(/resume/g, "")); });
    if (good.length) return good;
    const noCover = inputs.filter((i) => !/cover/.test(nearText(i)));
    return noCover.length === 1 ? noCover : [];
  }
  function chooseFile(input, files, fmt) {
    const acc = (input.accept || "").toLowerCase();
    const okDocx = !acc || /docx|\.doc|word|officedocument/.test(acc);
    const okPdf = !acc || /pdf/.test(acc);
    if (fmt === "pdf" && files.pdf && okPdf) return files.pdf;
    if (fmt === "docx" && files.docx && okDocx) return files.docx;
    if (files.docx && okDocx) return files.docx;
    if (files.pdf && okPdf) return files.pdf;
    return null;
  }
  async function attachFiles(list, fmt) {
    const files = {};
    list.forEach((f) => {
      const file = b64ToFile(f.b64, f.name, f.type);
      if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) files.pdf = file; else files.docx = file;
    });
    const inputs = findResumeInputs();
    let n = 0;
    for (const input of inputs) {
      const f = chooseFile(input, files, fmt);
      if (!f) continue;
      const dt = new DataTransfer();
      dt.items.add(f);
      input.files = dt.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const zone = input.closest("[class*=drop], [data-automation-id*=drop], [data-automation-id*=file-upload]");
      if (zone) { try { zone.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt })); } catch (e) {} }
      n++;
    }
    return n;
  }
  function jobKey() { return location.origin + location.pathname.replace(/\/(apply|application)\/?$/i, "").replace(/\/$/, ""); }
  async function attachStored(S) {
    const t = S.tailored && S.tailored.jobKey === jobKey() ? S.tailored : null;
    const list = [];
    if (t) {
      if (t.docxB64) list.push({ b64: t.docxB64, name: t.docxName, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      if (t.pdfB64) list.push({ b64: t.pdfB64, name: t.pdfName, type: "application/pdf" });
    } else if (S.resume) {
      const isPdf = /\.pdf$/i.test(S.resume.name);
      list.push({ b64: S.resume.b64, name: S.resume.name, type: isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    }
    if (!list.length) return 0;
    return attachFiles(list, S.settings.resumeFormat);
  }

  // ================= job description =================
  const JD_SELECTORS = ['[data-automation-id="jobPostingDescription"]', ".job__description", "#job-description", '[data-testid="job-description"]', ".jobs-description__content", "#jobDescriptionText", ".posting-page .content", ".section-wrapper.page-full-width", '[class*="job-description" i]', '[class*="jobDescription" i]', '[class*="job_description" i]', "article", "main"];
  function extractJD() {
    const sel = String(window.getSelection()).trim();
    const title = clean((document.querySelector("h1") || {}).innerText || document.title).slice(0, 140);
    const company = (document.querySelector('meta[property="og:site_name"]') || {}).content || "";
    if (sel.length > 200) return { text: sel.slice(0, 20000), title, company, source: "selection", url: location.href };
    for (const s of JD_SELECTORS) {
      const el = document.querySelector(s);
      const t = el && clean(el.innerText);
      if (t && t.length > 400) return { text: (el.innerText || "").trim().slice(0, 20000), title, company, source: s, url: location.href };
    }
    return { text: (document.body.innerText || "").trim().slice(0, 15000), title, company, source: "page", url: location.href };
  }
  async function cacheJD() {
    if (!isTop) return;
    const jd = extractJD();
    const forms = document.querySelectorAll("input:not([type=hidden]), textarea, select").length;
    if (jd.text.length > 800 && /responsibilit|requirement|qualification|about the (role|job)|what you/i.test(jd.text) && forms < 12) {
      const { jdCache = {} } = await chrome.storage.local.get("jdCache");
      jdCache[jobKey()] = { text: jd.text, title: jd.title, company: jd.company, ts: Date.now() };
      const keys = Object.keys(jdCache).sort((a, b) => jdCache[b].ts - jdCache[a].ts).slice(0, 15);
      const out = {};
      keys.forEach((k) => (out[k] = jdCache[k]));
      await chrome.storage.local.set({ jdCache: out });
    }
  }
  async function bestJD() {
    const jd = extractJD();
    const { jdCache = {} } = await chrome.storage.local.get("jdCache");
    const c = jdCache[jobKey()];
    const forms = document.querySelectorAll("input:not([type=hidden]), textarea, select").length;
    if (c && jd.source !== "selection" && (forms >= 12 || jd.text.length < 800)) return Object.assign({}, jd, { text: c.text, title: c.title || jd.title, company: c.company || jd.company, source: "cache" });
    return jd;
  }

  // ================= widget =================
  let host, root, ui = {};
  function looksLikeJobPage() {
    if (/myworkdayjobs|greenhouse\.io|lever\.co|ashbyhq|smartrecruiters|icims|workable|jobvite|taleo|successfactors|bamboohr/i.test(location.hostname)) return true;
    const t = (location.pathname + " " + document.title).toLowerCase();
    const n = document.querySelectorAll("input:not([type=hidden]), textarea, select").length;
    if (/apply|application|career|job|position|opening|talent/.test(t) && (n >= 4 || document.querySelector("input[type=file]"))) return true;
    return hasJD();
  }
  function hasJD() {
    const x = extractJD();
    const hits = (x.text.match(/responsibilit|requirement|qualification|about the (role|job)|what you|skills|experience|benefits|apply/gi) || []).length;
    if (x.source !== "page") return x.text.length > 600 && hits >= 2;
    return x.text.length > 1500 && hits >= 4 && document.querySelectorAll("input:not([type=hidden]), textarea, select").length < 15;
  }
  const CSS_W = `
  :host{all:initial}
  *{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}
  .fab{position:fixed;right:18px;bottom:18px;width:44px;height:44px;border-radius:14px;border:0;cursor:pointer;color:#fff;font-weight:800;font-size:18px;background:linear-gradient(135deg,#6366f1,#14b8a6);box-shadow:0 6px 20px rgba(15,23,42,.35);z-index:2147483647}
  .fab:hover{transform:translateY(-1px)}
  .bdg{position:absolute;right:-6px;top:-6px;min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:#64748b;color:#fff;font-size:11px;font-weight:700;display:none;align-items:center;justify-content:center;border:2px solid #fff}
  .bdg.on{display:flex}
  .wrap{position:fixed;right:18px;bottom:18px;z-index:2147483647}.wrap .fab{position:static}
  .card{position:fixed;right:18px;bottom:72px;width:280px;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 12px 36px rgba(15,23,42,.28);padding:14px;z-index:2147483647;display:none}
  .card.open{display:block}
  .hd{display:flex;align-items:center;gap:8px;margin-bottom:10px}
  .logo{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#14b8a6);color:#fff;display:grid;place-items:center;font-weight:800;font-size:13px}
  .hd b{font-size:14px;flex:1}.x{border:0;background:none;font-size:18px;cursor:pointer;color:#64748b}
  button.p,button.g{width:100%;border-radius:10px;padding:9px 12px;font-size:13px;font-weight:600;cursor:pointer;margin-top:6px}
  button.p{background:#4f46e5;color:#fff;border:1px solid #4f46e5}button.p:hover{background:#4338ca}
  button.g{background:#fff;color:#0f172a;border:1px solid #cbd5e1}button.g:hover{background:#f1f5f9}
  button:disabled{opacity:.5;cursor:default}
  .row{display:flex;gap:8px}.row button{margin-top:6px}
  .score{display:none;align-items:center;gap:12px;margin-top:10px;padding:10px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0}
  .score.on{display:flex}
  .ring{--p:0;--c:#16a34a;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(var(--c) calc(var(--p)*1%),#e2e8f0 0);flex:none}
  .ring:before{content:"";position:absolute;inset:6px;background:#f8fafc;border-radius:50%}.ring span{position:relative;font-weight:700;font-size:14px}
  .sm{font-size:12px;color:#64748b;line-height:1.35}.st{font-size:12px;color:#475569;margin-top:8px;min-height:16px}
  .bdg.err{background:#dc2626}
  .bk{margin-top:10px}.bk div.r{display:flex;align-items:center;gap:8px;font-size:12px;margin:5px 0}.bk .l{width:92px;color:#64748b}.bk .t{flex:1;height:6px;border-radius:4px;background:#e2e8f0;overflow:hidden}.bk .t i{display:block;height:100%}.bk .v{width:28px;text-align:right;font-weight:600}
  .ms{margin-top:8px;font-size:12px;color:#64748b;line-height:1.5}.ms b{color:inherit}
  .lnk{font-size:12px;color:#4f46e5;cursor:pointer;background:none;border:0;padding:0;margin-top:4px;font-weight:600}
  @media (prefers-color-scheme:dark){.card{background:#0f172a;color:#e2e8f0;border-color:#334155}.score{background:#1e293b;border-color:#334155}.ring:before{background:#1e293b}button.g{background:#1e293b;color:#e2e8f0;border-color:#475569}.sm,.st{color:#94a3b8}}`;

  async function ensureWidget() {
    if (!isTop || host) return;
    const S = await getStore();
    if (S.settings.showWidget === "never") return;
    if (S.settings.showWidget === "jobs" && !looksLikeJobPage()) return;
    host = document.createElement("div");
    host.id = "jn-host";
    root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS_W}</style>
      <div class="wrap"><button class="fab" title="Jobnaut">J</button><span class="bdg" id="bdg"></span></div>
      <div class="card">
        <div class="hd"><div class="logo">J</div><b>Jobnaut</b><button class="x" title="Close">×</button></div>
        <button class="p" id="lab">Resume Analytics</button>
        <button class="g" id="fill">Autofill this page</button>
        <div class="score" id="sc"><div class="ring" id="ring"><span>0</span></div><div><div id="sv" style="font-weight:600;font-size:13px"></div><div class="sm" id="sr"></div></div></div>
        <div id="bk"></div>
        <div class="st" id="st"></div>
      </div>`;
    document.documentElement.appendChild(host);
    const q = (s) => root.querySelector(s);
    ui = { card: q(".card"), bk: q("#bk"), st: q("#st"), sc: q("#sc"), ring: q("#ring"), sv: q("#sv"), sr: q("#sr"), bdg: q("#bdg") };
    q(".fab").onclick = () => ui.card.classList.toggle("open");
    q(".x").onclick = () => ui.card.classList.remove("open");
    q("#fill").onclick = async () => {
      ui.st.textContent = "Filling…";
      const r = await autofill();
      ui.st.textContent = r.empty ? "Add your info first (Prefill your Info)." : `Filled ${r.filled} field${r.filled === 1 ? "" : "s"}${r.skipped ? `, ${r.skipped} left for you` : ""}.`;
    };
    q("#lab").onclick = () => { openLab().catch((e) => (ui.st.textContent = "Could not open Resume Analytics: " + e.message)); ui.card.classList.remove("open"); };
  }
  function showScore(res) {
    if (!ui.sc) return;
    const v = res.overall;
    const colr = (n) => (n >= 75 ? "#16a34a" : n >= 50 ? "#d97706" : "#dc2626");
    ui.ring.style.setProperty("--p", v);
    ui.ring.style.setProperty("--c", colr(v));
    ui.ring.firstChild.textContent = v;
    ui.sv.textContent = res.aligned ? res.aligned[0].toUpperCase() + res.aligned.slice(1) + " match" : "ATS match";
    ui.sr.textContent = res.role || "";
    ui.sc.classList.add("on");
    const NM = { skills: "Skills", title: "Title & level", hard: "Requirements", narr: "Experience" };
    ui.bk.innerHTML = "";
    if (res.breakdown) {
      const w = document.createElement("div"); w.className = "bk";
      Object.keys(NM).forEach((k) => { const n = res.breakdown[k] || 0; const r = document.createElement("div"); r.className = "r"; r.innerHTML = `<span class="l">${NM[k]}</span><span class="t"><i style="width:${n}%;background:${colr(n)}"></i></span><span class="v">${n}</span>`; w.appendChild(r); });
      ui.bk.appendChild(w);
      if ((res.missing || []).length) { const m = document.createElement("div"); m.className = "ms"; m.textContent = "Missing: " + res.missing.join(", "); ui.bk.appendChild(m); }
    }
    ui.bdg.title = "ATS match " + v + "%"; ui.bdg.textContent = v; ui.bdg.className = "bdg on"; ui.bdg.style.background = colr(v);
  }

  // ================= Resume Analytics panel (docked inside this tab) =================
  let lab = null;
  async function openLab() {
    if (!isTop) return;
    if (!lab) {
      const r = await chrome.runtime.sendMessage({ type: "jn:whoami" });
      if (!r || r.tabId == null) throw new Error("tab id unavailable");
      const h = document.createElement("div");
      h.id = "jn-lab-host";
      const sr = h.attachShadow({ mode: "open" });
      sr.innerHTML = `<style>
        :host{all:initial}
        .box{position:fixed;top:12px;right:12px;width:360px;height:500px;max-height:calc(100vh - 92px);z-index:2147483646;border-radius:14px;overflow:hidden;box-shadow:0 14px 44px rgba(15,23,42,.35);border:1px solid rgba(100,116,139,.4);background:#fff}
        .box.tall{height:calc(100vh - 92px)}
        iframe{width:100%;height:100%;border:0;display:block;color-scheme:light dark}
      </style><div class="box"><iframe title="Jobnaut Resume Analytics"></iframe></div>`;
      const frame = sr.querySelector("iframe");
      frame.src = chrome.runtime.getURL("panel.html?tab=" + r.tabId);
      document.documentElement.appendChild(h);
      lab = { host: h, box: sr.querySelector(".box"), frame };
    }
    lab.host.style.display = "";
  }
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!lab || !d || d.jn !== "lab" || e.source !== lab.frame.contentWindow) return;
    if (d.act === "close") lab.host.style.display = "none";
    else if (d.act === "size") lab.box.classList.toggle("tall", !!d.tall);
    else if (d.act === "score") ensureWidget().then(() => showScore(d.res)).catch(() => {});
  });

  function toast(msg) {
    if (!isTop) return;
    ensureWidget().then(() => {
      let t = document.getElementById("__jn_toast");
      if (!t) {
        t = document.createElement("div");
        t.id = "__jn_toast";
        Object.assign(t.style, { position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "22px", zIndex: 2147483647, background: "#0f172a", color: "#fff", padding: "9px 14px", borderRadius: "10px", font: "13px system-ui,sans-serif", boxShadow: "0 6px 20px rgba(0,0,0,.3)", transition: "opacity .3s", opacity: "0", pointerEvents: "none" });
        document.documentElement.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = "1";
      clearTimeout(t._h);
      t._h = setTimeout(() => (t.style.opacity = "0"), 3000);
    });
  }

  // ================= messages =================
  chrome.runtime.onMessage.addListener((msg, _s, send) => {
    if (!msg || !msg.type) return;
    if (msg.type === "jn:autofill") { autofill(msg).then(send).catch((e) => send({ error: String(e) })); return true; }
    if (msg.type === "jn:getJD") { if (!isTop) return; bestJD().then(send); return true; }
    if (msg.type === "jn:openLab") { if (!isTop) return; openLab().then(() => send({ ok: true })).catch((e) => send({ ok: false, error: String(e) })); return true; }
    if (msg.type === "jn:attach") {
      attachFiles(msg.files, msg.format).then((n) => { toast(n ? "Jobnaut: tailored resume attached" : "Jobnaut: no resume upload field found on this page"); send({ attached: n }); });
      return true;
    }
  });

  // ================= boot =================
  if (isTop) {
    setTimeout(() => { cacheJD().catch(() => {}); ensureWidget().catch(() => {}); }, 1200);
    let tries = 0;
    const iv = setInterval(() => { if (host || ++tries > 20) return clearInterval(iv); ensureWidget().catch(() => {}); }, 2500);
  }
  window.__jobnautAutofill = autofill; // test hook
})();
