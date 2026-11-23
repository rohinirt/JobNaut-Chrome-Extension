// Jobnaut shared schema + helpers. Loaded by content script, options page, panel and service worker.
(function (g) {
  const JN = (g.JN = g.JN || {});
  const YN = ["Yes", "No"];

  JN.DEGREES = ["High school / GED", "Associate's", "Bachelor's", "Master's", "MBA", "Doctorate (PhD)", "Diploma", "Other"];

  JN.GROUPS = [
    { id: "home", label: "Home" },
    { id: "personal", label: "Personal" },
    { id: "experience", label: "Experience" },
    { id: "education", label: "Education" },
    { id: "work", label: "Work & preferences" },
    { id: "voluntary", label: "Voluntary disclosure" },
    { id: "custom", label: "Custom Q&A" },
    { id: "resume", label: "Resume & files" },
    { id: "settings", label: "Settings" }
  ];

  // kind: text | textarea | select | date
  JN.FIELDS = [
    // personal
    { key: "firstName", label: "First name", group: "personal", section: "Name" },
    { key: "middleName", label: "Middle name", group: "personal", section: "Name" },
    { key: "lastName", label: "Last name", group: "personal", section: "Name" },
    { key: "preferredName", label: "Preferred name", group: "personal", section: "Name" },
    { key: "email", label: "Email", group: "personal", section: "Contact" },
    { key: "phoneCode", label: "Phone country code", group: "personal", section: "Contact", hint: "e.g. +91" },
    { key: "phone", label: "Phone", group: "personal", section: "Contact" },
    { key: "address1", label: "Address line 1", group: "personal", section: "Address" },
    { key: "address2", label: "Address line 2", group: "personal", section: "Address" },
    { key: "city", label: "City", group: "personal", section: "Address" },
    { key: "state", label: "State / province", group: "personal", section: "Address" },
    { key: "zip", label: "Postal / ZIP code", group: "personal", section: "Address" },
    { key: "country", label: "Country", group: "personal", section: "Address" },
    { key: "citizenship", label: "Citizenship / nationality", group: "personal", section: "Address" },
    { key: "linkedin", label: "LinkedIn URL", group: "personal", section: "Links" },
    { key: "github", label: "GitHub URL", group: "personal", section: "Links" },
    { key: "website", label: "Portfolio / website", group: "personal", section: "Links" },
    // work & preferences
    { key: "currentCompany", label: "Current company", group: "work", section: "Current role", hint: "Blank = use latest experience entry" },
    { key: "currentTitle", label: "Current job title", group: "work", section: "Current role", hint: "Blank = use latest experience entry" },
    { key: "yearsExperience", label: "Total years of experience", group: "work", section: "Current role" },
    { key: "salaryExpectation", label: "Expected salary / CTC", group: "work", section: "Compensation & timing" },
    { key: "currentSalary", label: "Current salary / CTC", group: "work", section: "Compensation & timing" },
    { key: "noticePeriod", label: "Notice period", group: "work", section: "Compensation & timing", hint: "e.g. 30 days" },
    { key: "availableFrom", label: "Earliest start date", group: "work", section: "Compensation & timing" },
    { key: "authorized", label: "Legally authorized to work?", group: "work", section: "Eligibility", kind: "select", options: YN, intent: true },
    { key: "sponsorship", label: "Need visa sponsorship?", group: "work", section: "Eligibility", kind: "select", options: YN, intent: true },
    { key: "relocate", label: "Willing to relocate?", group: "work", section: "Eligibility", kind: "select", options: YN, intent: true },
    { key: "over18", label: "18 years or older?", group: "work", section: "Eligibility", kind: "select", options: YN, intent: true },
    { key: "backgroundCheck", label: "OK with background check?", group: "work", section: "Eligibility", kind: "select", options: YN, intent: true },
    { key: "previouslyEmployed", label: "Previously worked for the company?", group: "work", section: "Eligibility", kind: "select", options: YN, intent: true },
    { key: "nonCompete", label: "Bound by a non-compete?", group: "work", section: "Eligibility", kind: "select", options: YN, intent: true },
    { key: "workMode", label: "Preferred work mode", group: "work", section: "Preferences", kind: "select", options: ["Remote", "Hybrid", "On-site", "Flexible"] },
    { key: "travel", label: "Willing to travel", group: "work", section: "Preferences", hint: "e.g. Up to 25%" },
    { key: "hearAbout", label: "How did you hear about us?", group: "work", section: "Preferences", hint: "e.g. LinkedIn" },
    { key: "referral", label: "Referred by", group: "work", section: "Preferences" },
    { key: "languages", label: "Languages", group: "work", section: "Preferences" },
    { key: "skills", label: "Key skills", group: "work", section: "About you", kind: "textarea" },
    { key: "summary", label: "Short bio / about yourself", group: "work", section: "About you", kind: "textarea" },
    { key: "coverLetter", label: "Cover letter template", group: "work", section: "About you", kind: "textarea" },
    // voluntary disclosure
    { key: "gender", label: "Gender", group: "voluntary", kind: "select", options: ["Male", "Female", "Non-binary", "Decline to self-identify"] },
    { key: "pronouns", label: "Pronouns", group: "voluntary", kind: "select", options: ["He/Him", "She/Her", "They/Them", "Decline to self-identify"] },
    { key: "race", label: "Race / ethnicity", group: "voluntary", kind: "select", options: ["American Indian or Alaska Native", "Asian", "Black or African American", "Native Hawaiian or Other Pacific Islander", "White", "Two or More Races", "Decline to self-identify"] },
    { key: "hispanic", label: "Hispanic or Latino?", group: "voluntary", kind: "select", options: ["Yes", "No", "Decline to self-identify"], intent: true },
    { key: "veteran", label: "Veteran status", group: "voluntary", kind: "select", options: ["I am not a protected veteran", "I am a protected veteran", "Decline to self-identify"], intent: true },
    { key: "disability", label: "Disability status", group: "voluntary", kind: "select", options: ["No, I do not have a disability", "Yes, I have a disability", "Decline to self-identify"], intent: true },
    { key: "sexualOrientation", label: "Sexual orientation", group: "voluntary", kind: "select", options: ["Heterosexual / Straight", "Gay or Lesbian", "Bisexual", "Decline to self-identify"] },
    { key: "transgender", label: "Transgender?", group: "voluntary", kind: "select", options: ["Yes", "No", "Decline to self-identify"], intent: true }
  ];
  JN.FIELD = {};
  JN.FIELDS.forEach((f) => (JN.FIELD[f.key] = f));

  JN.EXP_FIELDS = [
    { key: "title", label: "Job title" },
    { key: "company", label: "Company" },
    { key: "location", label: "Location" },
    { key: "start", label: "Start", kind: "month" },
    { key: "end", label: "End", kind: "month" },
    { key: "current", label: "I currently work here", kind: "bool" },
    { key: "description", label: "Description / achievements", kind: "textarea" }
  ];
  JN.EDU_FIELDS = [
    { key: "school", label: "School / university" },
    { key: "degree", label: "Degree", kind: "select", options: JN.DEGREES },
    { key: "field", label: "Field of study" },
    { key: "start", label: "Start", kind: "month" },
    { key: "end", label: "End / graduation", kind: "month" },
    { key: "gpa", label: "GPA / grade" },
    { key: "location", label: "Location" }
  ];

  JN.DEFAULT_SETTINGS = {
    learn: true,
    overwrite: false,
    autoConsent: false,
    autoResume: true,
    autoReplace: true,
    highlightMissing: true,
    showWidget: "jobs", // jobs | always | never
    resumeFormat: "auto" // auto | docx | pdf
  };

  // ---------- label rules (applied to the normalised question text) ----------
  const R = (key, re, o) => Object.assign({ key, re }, o || {});
  JN.RULES = [
    R("edu.school", /\b(school|university|college|institution|institute)\b(?!.*\b(location|city|country)\b)/, { not: /high school diploma/ }),
    R("edu.degree", /\bdegree\b|level of education|education level|highest (level of )?(education|qualification)|qualification/),
    R("edu.field", /field of study|\bmajor\b|discipline|area of study|specializ|specialis|stream\b/),
    R("edu.gpa", /\bgpa\b|grade point|\bcgpa\b|percentage|\bgrade\b/),
    R("exp.current", /currently (work|employed|here|study)|current(ly)? (role|position|job)|\bpresent\b|still (work|employed)/, { ctx: "exp" }),
    R("exp.location", /\blocation\b|\bcity\b/, { ctx: "exp" }),
    R("edu.location", /\blocation\b|\bcity\b/, { ctx: "edu" }),
    R("exp.description", /description|responsibilit|achievement|duties|summary|details/, { ctx: "exp" }),
    R("exp.title", /\b(job|position|role) title\b|\btitle\b|\bposition\b|\brole\b/, { ctx: "exp" }),
    R("exp.company", /\b(company|employer|organi[sz]ation)\b/, { ctx: "exp" }),
    R("firstName", /\b(first|given|fore)\s*name\b|^first$/),
    R("middleName", /\bmiddle (name|initial)\b/),
    R("lastName", /\b(last|family|sur)\s*name\b|^last$/),
    R("preferredName", /\b(preferred|nick)\s*name\b|\bgoes by\b/),
    R("fullName", /^(your |legal |candidate )?(full )?(legal )?name$|\bfull (legal )?name\b|^name\b(?! of)/),
    R("email", /e-?mail/),
    R("phoneCode", /country (phone )?code|phone (country )?code|dial(ing)? code/),
    R("phone", /phone|mobile|\bcell\b|telephone|contact number/),
    R("linkedin", /linked ?in/),
    R("github", /git ?hub/),
    R("website", /portfolio|personal (web ?site|site|url|page)|\bwebsite\b|other (url|link)|\burl\b/),
    R("currentCompany", /current (company|employer|organi[sz]ation)|most recent (company|employer)|present employer/),
    R("currentTitle", /current (job )?(title|role|position)|most recent (job )?title/),
    R("exp.company", /\b(company|employer)( name)?\b/),
    R("hispanic", /hispanic|latino|latinx/),
    R("race", /\brace\b|ethnic/),
    R("gender", /\bgender\b|\bsex\b/, { not: /orientation|transgender/ }),
    R("transgender", /transgender/),
    R("pronouns", /pronoun/),
    R("veteran", /veteran|military service/),
    R("disability", /disabilit/),
    R("sexualOrientation", /sexual orientation|orientation/),
    R("yearsExperience", /years? of (relevant |total |professional |work |industry |related |hands on )?experience|how many years|experience \(years\)|total experience|years in/),
    R("currentSalary", /current (salary|ctc|compensation|pay)|present (salary|ctc)|fixed ctc/),
    R("salaryExpectation", /salary|compensation|\bctc\b|pay (expectation|range)|expected pay|desired (pay|salary)/),
    R("noticePeriod", /notice period|how soon can you (join|start)|serving notice/),
    R("availableFrom", /earliest (start|join)|start date|date available|available (from|on|to start|to join)|when can you start|joining date/),
    R("authorized", /(legally )?(authori[sz]ed|eligible|permitted|right|allowed|entitled) to work|work authori[sz]ation|work permit/),
    R("sponsorship", /sponsor|visa (status|support)|(require|need).*(visa|immigration)/),
    R("relocate", /relocat/),
    R("over18", /(at least|over|above|older than) 18|18 years|legal age|age of majority|\b18\+/),
    R("backgroundCheck", /background (check|screen|verification)|drug (test|screen)/),
    R("previouslyEmployed", /(previously|ever|formerly) (been )?(employed|worked)|former employee|worked (for|at|with) .*before|worked here before/),
    R("nonCompete", /non-?compete|restrictive covenant|non-?solicit/),
    R("referral", /referr?ed by|referral name|employee referral|who referred/),
    R("hearAbout", /how did you (hear|find|learn)|where did you (hear|find|learn)|referral source|source of application/),
    R("travel", /willing(ness)? to travel|travel (required|percentage)|% of travel/),
    R("address2", /address (line )?2|\bapt\b|\bsuite\b|\bunit\b|\bflat\b/),
    R("address1", /address (line )?1|street|^address$|\baddress\b/),
    R("zip", /\b(zip|postal|post) ?code\b|\bzip\b|\bpin ?code\b|postcode/),
    R("citizenship", /citizen|nationality/),
    R("country", /\bcountry\b/, { not: /code/ }),
    R("state", /\bstate\b|province|\bcounty\b/, { not: /united states|statement/ }),
    R("city", /^city\b|\bcity\b|\btown\b/),
    R("location", /^location\b|current location|where are you (currently )?(located|based)|your location|location \(city\)|^city,? state|current city/),
    R("workMode", /\bremote\b|\bhybrid\b|on-?site|work (arrangement|mode)/, { optionsOnly: true }),
    R("languages", /languages?( spoken| known)?\b/),
    R("skills", /\bskills\b|technologies|tech stack/),
    R("coverLetter", /cover letter/),
    R("summary", /tell us about yourself|about yourself|professional summary|short bio|introduce yourself|brief introduction/)
  ];

  // html autocomplete tokens
  JN.AC = {
    "given-name": "firstName", "family-name": "lastName", "additional-name": "middleName", name: "fullName",
    email: "email", tel: "phone", "tel-national": "phone", "address-line1": "address1", "address-line2": "address2",
    "address-level2": "city", "address-level1": "state", "postal-code": "zip", country: "country", "country-name": "country",
    organization: "currentCompany", "organization-title": "currentTitle", url: "website", nickname: "preferredName"
  };

  // id / name / data-automation-id rules for the big boards. 3rd item = capture group holding the entry index.
  JN.ATTR_RULES = [
    // Workday
    [/legalNameSection_firstName/i, "firstName"], [/legalNameSection_lastName/i, "lastName"], [/legalNameSection_middleName/i, "middleName"],
    [/addressSection_addressLine1/i, "address1"], [/addressSection_addressLine2/i, "address2"], [/addressSection_city/i, "city"],
    [/addressSection_countryRegion/i, "state"], [/addressSection_postalCode/i, "zip"], [/^countryDropdown$/i, "country"],
    [/^phone-number$/i, "phone"], [/^country-phone-code$/i, "phoneCode"], [/^email$/i, "email"],
    [/^jobTitle$/i, "exp.title"], [/^company$/i, "exp.company"], [/^roleDescription$/i, "exp.description"],
    [/^currentlyWorkHere$/i, "exp.current"], [/^school$/i, "edu.school"], [/^degree$/i, "edu.degree"],
    [/^fieldOfStudy$/i, "edu.field"], [/^gpa$/i, "edu.gpa"],
    // Greenhouse (job-boards) – explicit entry index in the id
    [/^school--(\d+)$/i, "edu.school", 1], [/^degree--(\d+)$/i, "edu.degree", 1], [/^discipline--(\d+)$/i, "edu.field", 1],
    [/^start-month--(\d+)$/i, "edu.start.month", 1], [/^start-year--(\d+)$/i, "edu.start.year", 1],
    [/^end-month--(\d+)$/i, "edu.end.month", 1], [/^end-year--(\d+)$/i, "edu.end.year", 1],
    [/^company-name-(\d+)$/i, "exp.company", 1], [/^title-(\d+)$/i, "exp.title", 1],
    [/^start-date-month-(\d+)$/i, "exp.start.month", 1], [/^start-date-year-(\d+)$/i, "exp.start.year", 1],
    [/^end-date-month-(\d+)$/i, "exp.end.month", 1], [/^end-date-year-(\d+)$/i, "exp.end.year", 1],
    [/^current-role-(\d+)$/i, "exp.current", 1],
    [/^candidate-location$/i, "location"],
    // Greenhouse classic education
    [/^education_school_name_(\d+)$/i, "edu.school", 1], [/^education_degree_(\d+)$/i, "edu.degree", 1], [/^education_discipline_(\d+)$/i, "edu.field", 1],
    // Lever
    [/^name$/i, "fullName"], [/^org$/i, "currentCompany"], [/^urls\[linkedin\]$/i, "linkedin"], [/^urls\[github\]$/i, "github"],
    [/^urls\[(portfolio|other|website)\]$/i, "website"], [/^location$/i, "location"],
    // Ashby
    [/_systemfield_name$/i, "fullName"], [/_systemfield_email$/i, "email"]
  ];

  // ---------- helpers ----------
  JN.norm = (s) =>
    String(s == null ? "" : s)
      .toLowerCase()
      .replace(/\((required|optional)\)/g, " ")
      .replace(/[*:?!,;()_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  JN.isSensitive = (q) => /password|passcode|\bssn\b|social security|card number|cvv|credit card|bank account|aadhaar|passport number|\botp\b|\bpan (card|number)\b/i.test(q || "");

  JN.hash = (s) => {
    s = String(s || "");
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + s.length.toString(36);
  };

  const STOP = new Set(["the", "a", "an", "of", "to", "you", "your", "do", "does", "are", "is", "please", "and", "or", "for", "in", "on", "we", "our", "us", "with", "this", "that", "have", "will", "be", "required", "optional"]);
  JN.tokens = (s) => JN.norm(s).split(" ").filter((t) => t && !STOP.has(t));
  JN.similarity = (a, b) => {
    const A = new Set(JN.tokens(a)), B = new Set(JN.tokens(b));
    if (!A.size || !B.size) return 0;
    let i = 0;
    A.forEach((t) => B.has(t) && i++);
    return i / (A.size + B.size - i);
  };

  JN.intent = (t) => {
    t = String(t || "").toLowerCase();
    if (/decline|prefer not|do not wish|don'?t wish|not to (answer|say|disclose|identify|specify)|choose not|rather not|not wish|no answer|not disclose/.test(t)) return "decline";
    if (/^no\b|\b(not|n't|never|none|neither)\b|\bdo not\b/.test(t)) return "no";
    return "yes";
  };

  JN.degreeKey = (t) => {
    t = String(t || "").toLowerCase();
    if (/\bmba\b/.test(t)) return "mba";
    if (/doctor|ph\.?\s?d/.test(t)) return "phd";
    if (/master|\bm\.?\s?(s|sc|a|tech|e|eng)\b\.?/.test(t)) return "master";
    if (/bachelor|\bb\.?\s?(s|sc|a|tech|e|eng|com|ba)\b\.?|undergrad/.test(t)) return "bachelor";
    if (/associate/.test(t)) return "associate";
    if (/high school|\bged\b|secondary|12th|\bhsc\b/.test(t)) return "hs";
    if (/diploma/.test(t)) return "diploma";
    return "";
  };

  const SYN = {
    male: ["man", "male"], female: ["woman", "female"], "non binary": ["non binary", "nonbinary", "non-binary", "genderqueer"],
    "he/him": ["he/him", "he him", "he"], "she/her": ["she/her", "she her", "she"], "they/them": ["they/them", "they them", "they"],
    "united states": ["united states", "usa", "us", "u.s.", "america"], "united kingdom": ["united kingdom", "uk", "great britain"],
    india: ["india", "bharat"]
  };

  const PLACEHOLDER = /^(select|choose|please select|--|-\s|pick|none selected)/i;
  JN.isPlaceholder = (t) => !String(t || "").trim() || PLACEHOLDER.test(String(t).trim());

  // opts: [{text, el?}] -> best option for the value
  JN.pickOption = (opts, value, intentMode) => {
    const v = JN.norm(value);
    if (!v) return null;
    opts = opts.filter((o) => !JN.isPlaceholder(o.text));
    if (!opts.length) return null;
    let m = opts.find((o) => JN.norm(o.text) === v);
    if (m) return m;
    if (intentMode) {
      const vi = JN.intent(value);
      const c = opts.filter((o) => JN.intent(o.text) === vi);
      if (c.length) return c.sort((a, b) => JN.similarity(b.text, value) - JN.similarity(a.text, value))[0];
    }
    const dk = JN.degreeKey(value);
    if (dk) {
      m = opts.find((o) => JN.degreeKey(o.text) === dk);
      if (m) return m;
    }
    const syn = SYN[v];
    if (syn) {
      m = opts.find((o) => syn.includes(JN.norm(o.text)));
      if (m) return m;
    }
    if (/^(decline|prefer not)/i.test(value)) {
      m = opts.find((o) => JN.intent(o.text) === "decline");
      if (m) return m;
    }
    m = opts.find((o) => {
      const t = JN.norm(o.text);
      return t && (t.includes(v) || (v.includes(t) && t.length > 2));
    });
    if (m) return m;
    let best = null, bs = 0;
    opts.forEach((o) => {
      const s = JN.similarity(o.text, value);
      if (s > bs) { bs = s; best = o; }
    });
    return bs >= 0.5 ? best : null;
  };

  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  JN.MONTHS = MON;
  // ym = "YYYY-MM"; returns formatted pieces
  JN.parseYM = (ym) => {
    const m = /^(\d{4})(?:-(\d{1,2}))?/.exec(String(ym || ""));
    return m ? { y: m[1], m: m[2] ? String(+m[2]).padStart(2, "0") : "" } : null;
  };
  JN.fmtDate = (ym, el, part) => {
    const p = JN.parseYM(ym);
    if (!p) return "";
    const ph = (el.placeholder || "").toLowerCase();
    if (part === "year") return p.y;
    if (part === "month") return p.m;
    if (el.type === "month") return p.m ? p.y + "-" + p.m : "";
    if (el.type === "date") return p.y + "-" + (p.m || "01") + "-01";
    if (/mm\s*\/\s*dd/.test(ph)) return (p.m || "01") + "/01/" + p.y;
    if (/dd\s*\/\s*mm/.test(ph)) return "01/" + (p.m || "01") + "/" + p.y;
    if (/mm\s*\/\s*yy/.test(ph) || /mm-yyyy/.test(ph)) return (p.m || "01") + "/" + p.y;
    if (/yyyy\s*-\s*mm/.test(ph)) return p.y + "-" + (p.m || "01");
    if (/^yyyy$|^year/.test(ph)) return p.y;
    if (/mmm|month/.test(ph) && p.m) return MON[+p.m - 1].slice(0, 3) + " " + p.y;
    return p.m ? p.m + "/" + p.y : p.y;
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
