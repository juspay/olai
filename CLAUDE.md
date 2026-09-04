**IMPORTANT** This file is hand-maintained. AI must not edit it, unless to make corrections or updates to existing content.

- [Claude only] If your model is Fabel, when spawning sub-agents - use Fable only where truly necessary, and use Opus by default.
- Keep docs up to date: website/ and docs/*.md — the engineering docs that change in the same PR as the code. 
- Prefer frequent-commits followed by CI (`just ci`), which is much faster than running local tests/checks.
   - Fastest way to run e2e outside of CI: `just e2e-fast-remote`
