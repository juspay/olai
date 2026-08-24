# Brief: view-pdf-csv-images — pdf, csv and images open as pages and sit in the sidebar

You are the AUTHOR of one PR in the olai repo, in a fresh worktree (`.worktrees/view-pdf-csv-images`, branch `view-pdf-csv-images`) of `/home/srid/code/olai`. Work only here. This is an OVERNIGHT lane: the human is asleep; your report and evidence are the merge gate, so make both true.

## The roadmap item (roadmap/features.olai → Documents & markdown → `view-pdf-csv-images`)

The precedent is `.html`: hypertext is part of the set carried as its PATH alone — body fetched when somebody opens it, kept by nobody (architecture.md). These three kinds take exactly that shape: new by-path rows in the ONE kinds table (`@olai/format` kinds.ts + format.md), so they join the set, the sidebar draws them, and prefix-free addresses reach them.

**Viewers, as ruled by the human:**
- Images (png/jpg/jpeg/gif/svg/webp): drawn as an image in olai's page chrome; svg as `<img>`, never inline DOM — the same trust boundary that sandboxes `.html`.
- `.csv`: parsed client-side on open into a read-only table — header row bold; a big file paged or clamped, with the clamp SAID (no silent truncation).
- `.pdf`: the browser's native viewer embedded (`<embed>`/iframe of the served path) — zero dependencies; sandboxed like `.html`.
- All three VIEW-ONLY; no editing.

**Touched-terrain warnings:** the raw-file serving path and `/media/` route already exist — serve the bytes and the page chrome from the addresses the sidebar mints without re-shadowing anything the bundle-prefix work (#341/#344) fixed. MCP's `list_documents`/`read_document` stay `.md`-only; whatever `.html` answers for the wire, these kinds answer the same way.

## Ground rules

- Read `HACKING.md` and `CLAUDE.md` at the repo root in FULL first.
- Open a PR; NEVER merge it. Keep docs up to date (format.md is load-bearing here; README/website where they list kinds).
- **No deferrals** — fold everything or STOP and ASK in this terminal. `## Deferrals` must say `No deferrals.` Flaky master tests you don't own: report under `## Observed`, carry on (a campaign is fixing them tonight — do NOT chase them).
- Local bar at report time: typecheck, unit, touched e2e features. Then post-implementation refactor passes (architecture-first-principles; hickey + lowy together; /simplify), isolated commits.
- CI once at your final head, AFTER the review round — the orchestrator will tell you when. Venue: localhost x86_64-linux under /tmp/olai-odu-localhost.lock with --host x86_64-linux=localhost. Either platform green is the bar; Linux only.

## Evidence — THE MERGE GATE, be thorough

The human pre-authorized auto-merge ON THE ORCHESTRATOR'S FRAME-BY-FRAME VERIFICATION of your evidence. Produce a video (or a full screenshot set) showing, in olai's real UI:
1. The sidebar listing a .pdf, a .csv, and images among the outlines/documents.
2. The .pdf open as a page in the embedded native viewer.
3. The .csv open as a rendered table (header bold) — and a big csv showing the SAID clamp.
4. At least one raster image and one svg open as pages.
5. An address bar visit to one of them (the prefix-free address resolving).
Upload via the uploads endpoint (`curl -s "https://uploads.github.com/user-attachments/assets?name=<f>&content_type=<mime>&repository_id=<id>" -X POST -H "Authorization: Bearer $(gh auth token)" --data-binary @<f>`; video on a bare line; ffmpeg via Nix for webm→mp4). Never commit proof assets.

## When done

Report here: PR URL + head SHA, what shipped per ruled point, suite counts, evidence links, `No deferrals.` The reviewer (Grok) comes next; stand by to address.