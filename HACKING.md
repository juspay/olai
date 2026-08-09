**IMPORTANT** This file is hand-maintained. AI must not edit it, unless to make corrections or updates to existing content.

## Code Review

- Tests
  - If a new feature was added, or a bug fixed, is there a test (unit or e2e) that reproduces it and ensures a future regression won't happen with tests passing?
- Docs
  - docs/* is up to date
  - All local packages have a concise README.md
- Web
  - UI components are encapsulated & isolated
  - Prefer multiple files & folder hierarchy for ease of navigation, over monolithic modules.
