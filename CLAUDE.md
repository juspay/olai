**IMPORTANT** This file is hand-maintained. AI must not edit it, unless to make corrections or updates to existing content.

- If your model is Fabel, when spawning sub-agents - use Fable only where truly necessary, and use Opus by default.

## PR workflow

- Keep docs up to date: README.md, docs/*.md
- CI = [odu SKILL.md](https://github.com/juspay/odu/blob/master/.apm/skills/odu/SKILL.md) (read in FULL), Linux; skip macOS unless the PR impacts macOS (this rule applies to all repos). On the PR is ready: run CI to satisfy "CI green". Merge latest master into the PR only when the PR has conflicts (or CI needs code from master).

## PR evidence uploads

- PR/issue images/video: `curl -s "https://uploads.github.com/user-attachments/assets?name=<f>&content_type=<mime>&repository_id=<id>" -X POST -H "Authorization: Bearer $(gh auth token)" -H "Accept: application/json" --data-binary @<f>`; embed returned `.url` as markdown. Same CDN as drag-drop; inherits repo visibility; no browser/computer use. 422 = unsupported type; 404 = bad repo id/no push. Non-media artifacts or endpoint failure: Crabbox artifact publishing plus the manifest URL. Never push proof assets to any product repo branch; do not commit `.github/pr-assets`.
- Video: same endpoint, `content_type` `video/mp4` or `video/webm` (both verified served). Embed as the returned URL on its own bare line — GitHub renders a player; `![]()` image syntax does not. Playwright records webm; transcode `ffmpeg -i in.webm -c:v libx264 -pix_fmt yuv420p out.mp4` before upload for broad playback. (Use Nix to get ffmpeg and the like.)
