# Jobnaut

Chrome extension (Manifest V3) that autofills job applications from your saved info, learns answers to unusual questions, and includes **Resume Analytics** (ATS match + resume rewrite) inside the job page.

## Set up
1. `node setup-vendor.mjs` once in this folder (downloads the libraries into `vendor/`).
2. `chrome://extensions` → Developer mode → Load unpacked → pick this folder.
3. Open the extension's options page (Prefill your Info), go to **Resume & files > AI** and paste your own free Gemini API key (from aistudio.google.com/apikey). The key stays in your browser only and is not part of the code or backups.
4. Follow the Home guide.

## Use
1. Open a job posting, click the **J** button, choose **Resume Analytics**, press **Analyse match**. Nothing is analysed until you press it.
2. Optionally **Rewrite my resume**; the new version replaces the resume on the application.
3. On the application form, click **J → Autofill this page** (or Alt+Shift+F).

## Resume Analytics panel
- Docks inside the current tab (top right, below the URL bar). Each tab has its own panel and only analyses that tab's job description.
- Stays open when you click the page. ✕ hides it, ⤢ makes it taller.
- Results are cached per job description + resume.

Delete `offscreen.html` and `offscreen.js` if you have them from an earlier version.
