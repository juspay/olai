**IMPORTANT** This file is hand-maintained. AI must not edit it, unless to make corrections or updates to existing content.

## Code Review

- Tests
  - If a new feature was added, or a bug fixed, is there a test (unit or e2e) that reproduces it and ensures a future regression won't happen with tests passing?
- Docs
  - docs/* is up to date
  - website/ is up to date
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
