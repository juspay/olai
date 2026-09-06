**IMPORTANT** This file is hand-maintained. AI must not edit it, unless to make corrections or updates to existing content.

- This application uses Cordis <https://github.com/cordiverse/cordis> a Meta-Framework of Spatiotemporal Composability based on https://arxiv.org/abs/2608.25512 - and Olai must be developed in prefect adherence to its principles. 
- [Claude only] If your model is Fabel, when spawning sub-agents - use Fable only where truly necessary, and use Opus by default.
- Keep docs/*.md up to date in the same PR as the code. website/ is the pitch for people, not a spec dump — touch it only if the reason to try olai changed, or a picture of something a person sees is now wrong. 
- Require full e2e coverage of user workflows and edge cases across the app; audit for missing coverage, fix discovered bugs, and do not treat a green existing suite as proof of completeness.
- Prefer frequent-commits followed by CI (`just ci`), which is much faster than running local tests/checks.
   - Fastest way to run e2e outside of CI: `just e2e-fast-remote`
