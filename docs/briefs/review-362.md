# Review brief: PR #362 — pdf, csv and images open as pages and sit in the sidebar (view-pdf-csv-images)

You are the REVIEWER. PR: https://github.com/juspay/olai/pull/362, head e0bf5225, branch view-pdf-csv-images. You are in the author's worktree (`.worktrees/view-pdf-csv-images`) — read, build, run; do not push.

1. Read `HACKING.md` in FULL; review per it.
2. The ruled scope (roadmap `view-pdf-csv-images`): by-path kinds like .html in the ONE kinds table; images png/jpg/jpeg/gif/svg/webp as <img> never inline DOM; csv as a read-only client-parsed table, header bold, clamp SAID; pdf via the browser's native viewer embedded; all view-only. The author argued two upgrades: <object> over <embed> (no-viewer fallback) and svg served inert (/media/* answering default-src 'none' + sandbox). Engage both on the merits.
3. SECURITY IS THE SHARP AXIS here — this PR makes the server hand vault bytes to browsers under new content types. Attack: the svg-inert claim on BOTH faces (as <img> and as a typed URL — script, foreignObject, external refs, the previewed-frame pull); the csv parser on hostile input (quotes, embedded newlines, a 2GB file, a 10k-column row — does the clamp bound WORK or only DISPLAY); the pdf <object> (can a vault .pdf address escape into plugin land or download surprise); the /media/* route's headers per kind; whether a .csv reachable as a page is also reachable raw where it should not be (fetched: false claim); path traversal on the new rows; MIME sniffing (nosniff where it matters?). Also the kinds-table column changes (holds="bytes", fetched) — do all existing kinds still answer right?
4. Verify, don't trust: typecheck, unit, the new feature file and html_previews; check the seven screenshots + video against what the code draws (they are scripted in evidence.ts — re-run it if cheap).
5. Post a PR COMMENT: OBJECT or DO-NOT-OBJECT, MUST/SHOULD/NIT with file:line, MUSTs with a failure scenario.
6. Report in this terminal: verdict, comment URL, one line per MUST.

Overnight: nobody answers questions before morning — rule-needing things go in the comment as findings.