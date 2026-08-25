**IMPORTANT** This file is hand-maintained. AI must not edit it, unless to make corrections or updates to existing content.

## Code Review

- Tests
  - If a new feature was added, or a bug fixed, there must be a corresponding test (unit or e2e)for it. 
  - Tests assert behavior, not styling. No class names, colors, or pixel values in assertions — unless the styling system itself is under test.
- Docs
  - docs/* is up to date
  - website/ is the pitch, not a changelog. Spec belongs in docs/. Touch it only if the reason to try olai changed, or a picture of something a person sees is now wrong. MCP tool names, refusals, and operator grammar do not belong on the landing page.
  - All local packages have a concise README.md
- Web
  - UI components are encapsulated & isolated
  - Prefer multiple files & folder hierarchy for ease of navigation, over monolithic modules.
- MCP
  - MCP and Web ops must be consistent; never deviate.
- SolidJS
  - Make full use of the ecosystem of libraries in SolidJS instead of hard-rolling.
- Error handling
  - Never silently ignore errors. Most errors should surface to the user at some level in the UX level.
- Dependencies
  - Olai continues to require **NO** dependencies *outside* of Nix itself
- PR
  - No junk (or unused) files accidentally commited in this PR.
