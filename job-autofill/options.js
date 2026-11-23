const $ = (s, r) => (r || document).querySelector(s);
const el = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => (k === "class" ? (e.className = v) : k.startsWith("on") ? (e[k] = v) : e.setAttribute(k, v)));
  kids.flat().forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
  return e;
};
let S = { profile: { experience: [], education: [] }, answers: [], settings: { ...JN.DEFAULT_SETTINGS }, resume: null, ai: { geminiKey: "", geminiModel: "" }, extras: { up: "", pj: "" }, tailored: null };
let tab = "home";
let t;

async function load() {
  const d = await chrome.storage.local.get(["profile", "answers", "settings", "resume", "resumeExtras", "tailored", "ai"]);
  S.ai = d.ai || { geminiKey: "", geminiModel: "" };
  S.profile = Object.assign({ experience: [], education: [] }, d.profile || {});
  S.answers = d.answers || [];
  S.settings = Object.assign({}, JN.DEFAULT_SETTINGS, d.settings || {});
  S.resume = d.resume || null;
  S.extras = d.resumeExtras || { up: "", pj: "" };
  S.tailored = d.tailored || null;
  if (location.hash) tab = location.hash.slice(1);
  nav();
  render();
}
function save() {
  clearTimeout(t);
  $("#saved").textContent = "Saving…";
  t = setTimeout(async () => {
    await chrome.storage.local.set({ profile: S.profile, answers: S.answers, settings: S.settings, resumeExtras: S.extras });
    $("#saved").textContent = "All changes saved";
  }, 350);
}
function nav() {
  const n = $("#nav");
  n.innerHTML = "";
  JN.GROUPS.forEach((g) => n.append(el("button", { class: g.id === tab ? "on" : "", onclick: () => { tab = g.id; location.hash = g.id; nav(); render(); } }, g.label)));
}
function head(title, lead) { return [el("h1", {}, title), el("p", { class: "lead" }, lead)]; }

// ---------- generic field ----------
function control(f, obj, key, onchange) {
  let c;
  const val = obj[key] || "";
  if (f.kind === "select") {
    c = el("select", {}, el("option", { value: "" }, "— not set —"), (f.options || []).map((o) => el("option", { value: o }, o)));
    c.value = val;
  } else if (f.kind === "textarea") { c = el("textarea", {}); c.value = val; }
  else if (f.kind === "month") { c = el("input", { type: "month" }); c.value = val; }
  else { c = el("input", { type: "text", placeholder: f.hint || "" }); c.value = val; }
  const h = () => { obj[key] = c.value; save(); onchange && onchange(); };
  c.oninput = h; c.onchange = h;
  return c;
}
function field(f, obj, key) {
  const wrap = el("div", { class: f.kind === "textarea" ? "wide" : "" }, el("label", { class: "f" }, f.label), control(f, obj, key || f.key));
  if (f.hint && f.kind !== undefined) wrap.append(el("div", { class: "hint" }, f.hint));
  return wrap;
}

function renderGroup(id, title, lead) {
  const v = $("#view");
  v.append(...head(title, lead));
  const sections = [];
  JN.FIELDS.filter((f) => f.group === id).forEach((f) => {
    const name = f.section || "";
    let s = sections.find((x) => x.name === name);
    if (!s) sections.push((s = { name, items: [] }));
    s.items.push(f);
  });
  sections.forEach((s) => {
    if (s.name) v.append(el("h2", {}, s.name));
    const g = el("div", { class: "grid" });
    s.items.forEach((f) => g.append(field(f, S.profile)));
    v.append(el("div", { class: "card" }, g));
  });
}

// ---------- repeaters ----------
function renderRepeater(type) {
  const isExp = type === "experience";
  const v = $("#view");
  const list = (S.profile[type] = S.profile[type] || []);
  const defs = isExp ? JN.EXP_FIELDS : JN.EDU_FIELDS;
  v.append(...head(isExp ? "Experience" : "Education", isExp ? "Most recent first. Jobnaut fills each work-history block in this order and clicks “Add” on the application when it needs more." : "Most recent first. The first entry is used for “highest education” questions."));
  list.forEach((entry, i) => {
    const g = el("div", { class: "grid" });
    defs.forEach((f) => {
      if (f.kind === "bool") {
        const cb = el("input", { type: "checkbox" });
        cb.checked = !!entry.current;
        cb.onchange = () => { entry.current = cb.checked; save(); render(); };
        g.append(el("label", { class: "row" }, cb, "I currently work here"));
      } else if (f.key === "end" && entry.current) {
        g.append(el("div", {}, el("label", { class: "f" }, "End"), el("div", { class: "hint" }, "Present")));
      } else g.append(field(f, entry, f.key));
    });
    const title = isExp ? (entry.title || "New role") + (entry.company ? " · " + entry.company : "") : (entry.school || "New education");
    v.append(el("div", { class: "card" }, el("div", { class: "entry-h" }, el("b", {}, title),
      el("button", { class: "sm", onclick: () => { if (i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); save(); render(); } } }, "↑"),
      el("button", { class: "sm", onclick: () => { if (i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); save(); render(); } } }, "↓"),
      el("button", { class: "sm d", onclick: () => { list.splice(i, 1); save(); render(); } }, "Remove")), g));
  });
  v.append(el("button", { class: "p", onclick: () => { list.push({}); save(); render(); } }, isExp ? "+ Add experience" : "+ Add education"));
}

// ---------- custom Q&A ----------
function renderCustom() {
  const v = $("#view");
  v.append(...head("Custom Q&A", "Questions Jobnaut learned from your manual answers, plus any you add yourself. Similar wording on other sites is matched automatically."));
  const q = el("input", { type: "text", placeholder: "Question, e.g. Why do you want to work here?" });
  const a = el("textarea", { placeholder: "Your answer. For multi-select questions separate options with commas." });
  v.append(el("div", { class: "card" }, el("label", { class: "f" }, "Add a question"), q, el("div", { style: "height:8px" }), a,
    el("div", { class: "row", style: "margin-top:10px" }, el("button", { class: "p", onclick: () => {
      if (!q.value.trim() || !a.value.trim()) return;
      S.answers.unshift({ q: JN.norm(q.value), question: q.value.trim(), answer: a.value.trim(), type: "text", source: "manual", host: "", updated: Date.now() });
      save(); render();
    } }, "Add"))));
  const search = el("input", { type: "search", placeholder: "Search saved questions…" });
  const body = el("tbody");
  const paint = () => {
    body.innerHTML = "";
    const term = search.value.toLowerCase();
    const rows = S.answers.map((x, i) => [x, i]).filter(([x]) => !term || (x.question + x.answer).toLowerCase().includes(term));
    if (!rows.length) body.append(el("tr", {}, el("td", { colspan: 3, class: "empty" }, S.answers.length ? "No matches." : "Nothing here yet. Answer an unusual question on an application and it will appear.")));
    rows.forEach(([x, i]) => {
      const ans = el("textarea", { rows: 2 }); ans.value = x.answer;
      ans.oninput = () => { x.answer = ans.value; x.updated = Date.now(); save(); };
      body.append(el("tr", {}, el("td", { style: "width:42%" }, x.question, el("div", { class: "hint" }, el("span", { class: "pill " + (x.source === "manual" ? "" : "ok") }, x.source === "manual" ? "Manual" : "Learned"), x.host ? " " + x.host : "")), el("td", {}, ans),
        el("td", { style: "width:70px" }, el("button", { class: "sm d", onclick: () => { S.answers.splice(i, 1); save(); paint(); } }, "Delete"))));
    });
  };
  search.oninput = paint;
  v.append(el("div", { class: "card" }, search, el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Question"), el("th", {}, "Answer"), el("th", {}))), body)));
  paint();
}

// ---------- resume & files ----------
const bufToB64 = (buf) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
async function readAny(f) {
  if (!/\.docx$/i.test(f.name)) return f.text();
  const zip = await JSZip.loadAsync(await f.arrayBuffer());
  const doc = new DOMParser().parseFromString(await zip.file("word/document.xml").async("string"), "application/xml");
  return [...doc.getElementsByTagNameNS(NS, "p")].map((p) => [...p.getElementsByTagNameNS(NS, "t")].map((t) => t.textContent).join("")).filter((x) => x.trim()).join("\n");
}
function renderResume() {
  const v = $("#view");
  v.append(...head("Resume & files", "Upload once. Jobnaut attaches it to applications, and Resume Analytics uses it to score and rewrite for each job."));
  const fr = el("input", { type: "file", accept: ".docx", hidden: "" });
  fr.onchange = async () => {
    const f = fr.files[0]; if (!f) return;
    S.resume = { name: f.name, b64: bufToB64(await f.arrayBuffer()), size: f.size, ts: Date.now() };
    await chrome.storage.local.set({ resume: S.resume }); render();
  };
  v.append(el("div", { class: "card" }, el("div", { class: "row" },
    el("div", {}, el("b", {}, S.resume ? S.resume.name : "No resume uploaded"), el("div", { class: "mute" }, S.resume ? Math.round(S.resume.size / 1024) + " KB · " + new Date(S.resume.ts).toLocaleDateString() : ".docx recommended so formatting is kept when rewriting")),
    el("div", { class: "sp row" }, S.resume ? el("button", { class: "sm d", onclick: async () => { S.resume = null; await chrome.storage.local.remove("resume"); render(); } }, "Remove") : null,
      el("button", { class: "p", onclick: () => fr.click() }, S.resume ? "Replace resume" : "Upload resume")), fr)));
  if (S.tailored && S.tailored.docxName) v.append(el("div", { class: "card" }, el("div", { class: "row" }, el("div", {}, el("b", {}, "Latest tailored resume"), el("div", { class: "mute" }, S.tailored.docxName + " · " + new Date(S.tailored.ts).toLocaleString())), el("span", { class: "pill ok sp" }, "From Resume Analytics"))));
  const area = (key, label, hint) => {
    const ta = el("textarea", { placeholder: hint }); ta.value = S.extras[key] || "";
    ta.oninput = () => { S.extras[key] = ta.value; save(); };
    const f = el("input", { type: "file", accept: ".docx,.txt,.md" });
    f.onchange = async () => { ta.value = await readAny(f.files[0]); S.extras[key] = ta.value; save(); };
    return el("div", { class: "card" }, el("label", { class: "f" }, label), f, el("div", { style: "height:8px" }), ta);
  };
  v.append(area("up", "Extra experience details (optional)", "Extra bullets, metrics or context the rewrite may use. Without it, only your resume is used."));
  v.append(area("pj", "Projects (optional, include links)", "Projects to choose from, with links."));
  const hasKey = () => !!String((S.ai || {}).geminiKey || "").trim();
  const pill = el("span", { class: "pill sp " + (hasKey() ? "ok" : "") }, hasKey() ? "Key saved" : "Key missing");
  const kin = el("input", { type: "password", placeholder: "Paste your Gemini API key", autocomplete: "off", spellcheck: "false" });
  kin.value = (S.ai || {}).geminiKey || "";
  const min = el("input", { type: "text", placeholder: "Optional, e.g. gemini-2.5-flash (leave blank for default)" });
  min.value = (S.ai || {}).geminiModel || "";
  const msg = el("div", { class: "hint", style: "margin-top:8px" }, "");
  const persist = async () => {
    S.ai = { geminiKey: kin.value.trim(), geminiModel: min.value.trim() };
    await chrome.storage.local.set({ ai: S.ai });
    try { if (S.ai.geminiKey) localStorage.setItem("ro_gemini_key", S.ai.geminiKey); else localStorage.removeItem("ro_gemini_key"); if (S.ai.geminiModel) localStorage.setItem("ro_gemini_model", S.ai.geminiModel); else localStorage.removeItem("ro_gemini_model"); } catch (e) {}
    pill.textContent = hasKey() ? "Key saved" : "Key missing"; pill.className = "pill sp " + (hasKey() ? "ok" : "");
  };
  const show = el("button", { class: "sm", onclick: () => { const h = kin.type === "password"; kin.type = h ? "text" : "password"; show.textContent = h ? "Hide" : "Show"; } }, "Show");
  v.append(el("h2", {}, "AI (ATS score and rewrite)"), el("div", { class: "card" },
    el("div", { class: "row" }, el("div", {}, el("b", {}, "Google Gemini API key"),
      el("div", { class: "mute" }, "Your own key, kept only in this browser. Get a free one at aistudio.google.com/apikey.")), pill),
    el("div", { style: "height:10px" }), el("label", { class: "f" }, "API key"),
    el("div", { class: "row" }, el("div", { style: "flex:1" }, kin), show),
    el("div", { style: "height:8px" }), el("label", { class: "f" }, "Model (optional)"), min,
    el("div", { style: "height:10px" }),
    el("div", { class: "row" },
      el("button", { class: "p", onclick: async () => { await persist(); msg.textContent = hasKey() ? "Saved. Resume Analytics will use this key." : "Key cleared."; } }, "Save key"),
      el("button", { class: "sm d", onclick: async () => { kin.value = ""; await persist(); msg.textContent = "Key removed from this browser."; } }, "Remove key")),
    msg,
    el("div", { class: "hint", style: "margin-top:6px" }, "When you press Analyse or Rewrite, your resume text and the job description are sent to Google Gemini using this key. The key is not included in Export JSON.")));
}

// ---------- settings ----------
function renderSettings() {
  const v = $("#view");
  v.append(...head("Settings", "Everything is stored locally in your browser. Nothing is sent anywhere except resume text to the AI provider you choose in Resume Analytics."));
  const tog = (key, title, desc) => {
    const cb = el("input", { type: "checkbox" }); cb.checked = !!S.settings[key];
    cb.onchange = () => { S.settings[key] = cb.checked; save(); };
    return el("label", { class: "tog" }, cb, el("div", {}, el("b", {}, title), el("span", { class: "mute" }, desc)));
  };
  const sel = (key, title, opts) => {
    const s = el("select", { style: "max-width:240px" }, opts.map(([v2, l]) => el("option", { value: v2 }, l))); s.value = S.settings[key];
    s.onchange = () => { S.settings[key] = s.value; save(); };
    return el("div", { class: "tog" }, el("div", { style: "flex:1" }, el("b", {}, title)), s);
  };
  v.append(el("div", { class: "card" },
    tog("learn", "Learn new answers", "Save answers you type for questions not covered by your profile."),
    tog("overwrite", "Overwrite filled fields", "Replace values already on the page when autofilling."),
    tog("autoResume", "Attach resume when autofilling", "Upload your resume (or the tailored one for this job) to the resume field."),
        tog("autoReplace", "Auto-replace resume after a rewrite", "When Resume Analytics finishes a rewrite, swap it into the application's upload field."),
    tog("autoConsent", "Tick consent / acknowledgement boxes", "Off by default. Only enable if you are happy to agree to privacy notices automatically."),
    tog("highlightMissing", "Highlight required fields I couldn't fill", "Amber dashed outline on the page."),
    sel("showWidget", "Floating button", [["jobs", "On job pages only"], ["always", "Everywhere"], ["never", "Hide (use toolbar / Alt+Shift+F)"]]),
    sel("resumeFormat", "Resume file format", [["auto", "Auto (DOCX, PDF if required)"], ["docx", "Prefer DOCX"], ["pdf", "Prefer PDF"]])));
  const imp = el("input", { type: "file", accept: "application/json", hidden: "" });
  imp.onchange = async () => {
    try {
      const d = JSON.parse(await imp.files[0].text());
      await chrome.storage.local.set({ profile: d.profile || {}, answers: d.answers || [], settings: d.settings || JN.DEFAULT_SETTINGS, resumeExtras: d.resumeExtras || {} });
      load();
    } catch (e) { alert("That is not a valid Jobnaut backup."); }
  };
  v.append(el("h2", {}, "Backup"), el("div", { class: "row" },
    el("button", { onclick: async () => {
      const d = await chrome.storage.local.get(["profile", "answers", "settings", "resumeExtras"]);
      const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" })), download: "jobnaut-backup.json" });
      a.click();
    } }, "Export JSON"), el("button", { onclick: () => imp.click() }, "Import JSON"), imp));
}

function goto(id) { tab = id; location.hash = id; nav(); render(); }
function renderHome() {
  const v = $("#view");
  const p = S.profile;
  const steps = [
    ["Fill in your basics", "Name, email, phone and links.", !!(p.firstName && p.email), "personal"],
    ["Add experience and education", "Most recent first.", (p.experience || []).length > 0 && (p.education || []).length > 0, "experience"],
    ["Answer the common questions", "Work authorization, notice period, voluntary disclosure.", !!(p.authorized || p.noticePeriod), "work"],
    ["Upload your resume", "A .docx keeps its formatting when rewritten.", !!S.resume, "resume"],
    ["Add your Gemini key", "Free from Google AI Studio. Needed for Resume Analytics.", !!String((S.ai || {}).geminiKey || "").trim(), "resume"]
  ];
  const done = steps.filter((s) => s[2]).length;
  const next = (steps.find((s) => !s[2]) || steps[0])[3];

  // hero: pitch on the left, live setup checklist on the right
  const list = el("div", { class: "setup" }, steps.map((s, i) => el("button", { class: "chk", onclick: () => goto(s[3]) },
    el("span", { class: "dot " + (s[2] ? "on" : "") }, s[2] ? "✓" : String(i + 1)),
    el("span", { class: "ct" }, el("b", {}, s[0]), el("small", {}, s[1])),
    el("span", { class: "go" }, "›"))));
  v.append(el("section", { class: "hero2" },
    el("div", { class: "pitch" }, el("div", { class: "eyebrow" }, "JOBNAUT"),
      el("h1", {}, "Apply faster. Apply sharper."),
      el("p", {}, "Check how well your resume fits a job, tailor it using only your real experience, then fill in the application in one click. Jobnaut also remembers every unusual question you answer."),
      el("div", { class: "row" }, el("button", { class: "cta", onclick: () => goto("personal") }, "Get started →"),
        el("button", { class: "ghost", onclick: () => document.getElementById("how").scrollIntoView({ behavior: "smooth" }) }, "See how it works"))),
    el("div", { class: "card setupcard" }, el("div", { class: "row", style: "margin-bottom:6px" }, el("b", {}, "Get set up"), el("span", { class: "pill sp " + (done === steps.length ? "ok" : "") }, done + " of " + steps.length + " done")),
      list, el("button", { class: "p wfull", onclick: () => goto(next) }, done === steps.length ? "Review your info" : "Continue setup"))));

  // how it works, with screenshots
  const how = [
    ["Prefill your info once", "Click Get started and fill in Personal, Experience, Education and the common questions. Upload your resume under Resume & files.", "guide/1-prefill.png"],
    ["Open a job and click the J button", "On any job posting a small J button appears at the bottom right. Click it, then choose Resume Analytics. Nothing is analysed until you ask.", "guide/2-job.png"],
    ["Analyse your resume against the job", "In Resume Analytics press Analyse match. You get an ATS score, a breakdown and the skills you are missing. The score also appears on the J button.", "guide/3-analyse.png"],
    ["Rewrite your resume (optional)", "Press Rewrite my resume to tailor it to this job using only facts already in your resume. The new version replaces the resume on the application automatically.", null],
    ["Apply and autofill the form", "Open the application form, click J, then Autofill this page (or press Alt+Shift+F). Review the highlighted fields, fix anything left, and submit.", "guide/4-autofill.png"]
  ];
  v.append(el("h2", { id: "how", class: "sec-h" }, "How it works"));
  v.append(el("div", { class: "steps" }, how.map((s, i) => el("div", { class: "step" },
    el("div", { class: "stext" }, el("span", { class: "snum" }, String(i + 1)), el("h3", {}, s[0]), el("p", {}, s[1])),
    s[2] ? el("div", { class: "shot" }, (() => { const im = el("img", { src: s[2], alt: s[0], loading: "lazy" }); im.onerror = () => { im.replaceWith(el("div", { class: "noshot" }, "Screenshot coming soon")); }; return im; })()) : el("div", { class: "shot alt" }, el("div", { class: "noshot" }, "Rewrites only rephrase what is already true, then you review the result."))))));

  v.append(el("h2", { class: "sec-h" }, "What Jobnaut can do"));
  const feats = [
    ["⚡", "Autofill applications", "Text boxes, dropdowns, radios, checkboxes and custom widgets. Workday, Greenhouse, Lever and more, including repeated work-history and education blocks."],
    ["🧠", "Learns new questions", "Answer an unusual question once and it is saved. Similar wording elsewhere is filled automatically."],
    ["📊", "ATS match score", "A score, a four-part breakdown and the exact skills you are missing, for the job you are looking at."],
    ["✍️", "Tailored resume", "Rewrites using your real experience only, then swaps the new file into the application's upload field."]
  ];
  v.append(el("div", { class: "feats4" }, feats.map((f) => el("div", { class: "card feat" }, el("div", { class: "ficon" }, f[0]), el("b", {}, f[1]), el("div", { class: "mute" }, f[2])))));

  v.append(el("h2", { class: "sec-h" }, "Good to know"));
  const faq = [
    ["Where is my data stored?", "Only in this browser. Resume text is sent to Google Gemini when you press Analyse or Rewrite, and nowhere else."],
    ["Does it analyse every job page automatically?", "No. Resume Analytics only runs when you press Analyse match."],
    ["I have several job tabs open. Which one is analysed?", "Each tab has its own Resume Analytics panel, docked inside that tab. It always analyses the job in its own tab."],
    ["What about passwords and consent boxes?", "Passwords, card and ID numbers are never filled or saved. Consent and privacy boxes are only ticked if you turn that on in Settings."],
    ["The job description looks wrong.", "Open the Job description box in Resume Analytics. Select the right text on the page and press Re-read, or edit it there."]
  ];
  v.append(el("div", { class: "faq" }, faq.map((f) => el("details", { class: "card" }, el("summary", {}, f[0]), el("p", {}, f[1])))));
  v.append(el("div", { class: "endcta" }, el("div", {}, el("b", { style: "font-size:17px" }, "Ready when you are"), el("div", { class: "mute" }, "It takes about five minutes to set up, once.")), el("button", { class: "cta", onclick: () => goto("personal") }, "Get started →")));
}

function render() {
  const v = $("#view");
  v.innerHTML = "";
  v.className = tab === "home" ? "home" : "";
  if (tab === "home") renderHome();
  else if (tab === "personal") renderGroup("personal", "Personal", "The basics every application asks for.");
  else if (tab === "experience") renderRepeater("experience");
  else if (tab === "education") renderRepeater("education");
  else if (tab === "work") renderGroup("work", "Work & preferences", "Eligibility, salary, notice period and the other common yes/no questions.");
  else if (tab === "voluntary") renderGroup("voluntary", "Voluntary disclosure", "Equal-opportunity questions. Choose “Decline to self-identify” or leave blank to skip them.");
  else if (tab === "custom") renderCustom();
  else if (tab === "resume") renderResume();
  else renderSettings();
}
load();
