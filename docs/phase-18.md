# Phase 18 implementation checklist

Phase 18 is in progress. The acceptance contract is the September 5 proposal
in `oss.olai/brainstorming/cordis-for-olai.md`. This work must land as one
complete PR; intermediate commits are not separately complete phases.

Checked items describe implemented work or specific passing coverage. A plugin
with remaining unchecked items is not fully extracted. All acceptance items must
be complete before this PR is ready to merge.

Last complete CI: code commit `55b5bee87` passed all 49 checks, including
1,446 browser scenarios. That result predates the substantial extraction now
in progress and does not validate the current working tree.

Current integration: `7df53a64b` completed full `just ci`: 47 checks passed and
2 failed. All typechecks and unit tests passed; the sole browser failure was
initial font loading racing the request recorder (plus the aggregate check).
The corrected font/theme group passes all nine scenarios and 52 steps.
Final review also closed loader admission while owner cleanup drains and
revoked retained MCP credentials at ticket release, including delayed tool
writes and provider reactivation. Their regression groups pass. The integrated
repair awaits a complete green CI run.

GitHub CodeQL also flagged case-sensitive script extraction in the theme asset
test. The regex is corrected and both first-paint tests pass. GitHub CodeQL
passed on `29b1db404`, `f46e31fe4` `80248fc35` and `7df53a64b`, reporting no new alerts
in the PR’s changed code.

## CI repair batch

- [x] Retract MCP tools and resources with their capabilities; retained clients
  resolve current handlers and write authority. The MCP regression group passes
  109 tests, with focused process tests covering repeated reactivation.
- [x] Keep supplemental vault and source-plugin HTTP routes passive: no listener
  opens until an actual transport starts. The real-port lifecycle test passes.
- [x] Repair migrated asset fixtures, surface shape expectations and real-Git
  test budgets. All 53 focused server, scratch, surface and Git tests pass.
- [x] Restore document fragment navigation and split panes through independent
  metadata requests: 63 browser scenarios and 589 steps pass.
- [x] Keep contributed page data reactive through getter-backed props. Daily-note
  pending writes and page filtering pass all 12 browser scenarios and 89 steps.
- [x] Make browser `@plugins:` tags exact, listing required extracted capabilities
  in each feature. Journal absence and the counter-only selection pass.
- [x] Repair moved architecture assertions and canonical plugin documentation;
  boundary tests pass all 43 cases, including indirect import graphs.
- [x] Restore pin reorder/removal Undo to the focused page history: all 23
  shelf/recovery scenarios pass, including explicit Undo/Redo regressions.
- [x] Move Kolu, Odu and Spaces state into activation scopes with providers
  around their own contributions. The Kolu test proves five subscriptions
  are released and a fresh activation reacquires them.
- [ ] Pass the next complete CI run on the integrated repair commit.
- [x] Validate content withdrawal, history and owner changes: 28 scenarios and
  543 steps pass; two cold-start selections prove independently enabled
  Markdown and outlines, and two renderer smoke scenarios pass.
- [x] Fix delayed-write test interception across websocket reconnect URLs.
  Daily-note and capture tests pass all five scenarios and 70 steps, with
  server writes observed while client replies remain held.
- [x] Verify fault cards and independently loaded document previews: all 33
  scenarios pass. Render fault injection preserves the exact error assertion.
- [x] Repair vault withdrawal without hiding actual runtime faults. A scoped
  subscription normalizes Effect’s cancellation sentinel; two regression tests
  preserve real defect reporting, and both vault workflows pass all 28 steps.
- [x] Repair Chat reactivation cleanup; all three question workflows pass.
  Observer cleanup tests also cover notification, click, audio and naming scopes.

## Current implementation batch

- [x] Move navigation/router/history/focus and palette implementation into
  `navigation`; remove the permanent file-link furniture publication.
- [x] Move outline tree/editor/selection/undo/drag/property modules into
  `outlines`, and document reader/editor state into independent `markdown`.
- [x] Move shared Markdown text rendering and undo algorithms into narrow
  static libraries; outline notes do not require the Markdown document plugin.
- [x] Replace built-in sidebar content with files/pins/capture/trash
  contributions; move pane geometry into layout.
- [x] Move theme tables, first-paint bootstrap, generated styles/font assets and
  scoped browser chrome to their owners. A full browser build has succeeded.
- [x] Implement scoped Surface composition for preserved unprefixed tags and
  disjoint procedure variants. Four focused tests pass, including withdrawal,
  retained-handler revocation, collisions, fresh generations, and refusal of
  inconsistent face grants or write attribution between shared variants.
- [x] Add independent server bindings for outlines, Markdown, files, pins,
  capture and trash; the permanent runtime no longer binds those readings.
- [x] Move source discovery/compiler/approval/chunk code into `vault-plugins`.
- [x] Validate owned-loader cleanup: children and catalogs leave with their
  owner, retained loaders are revoked, reactivation is fresh, and disposal
  waits for pending-child cleanup. Admission closes immediately when the owner
  begins draining, before blocked child finalizers finish: a deterministic
  regression previously mounted a late child during that window. The loader
  now checks the public Scope state; all three focused tests pass. This uncovered and
  fixed non-idempotent disposal in the direct Cordis mount adapter.
- [x] Run relocated dynamic policy and documentation-example tests: 23 pass.
- [x] Test actual policy withdrawal/reactivation: owned definitions, catalogs,
  chunk access and retained procedures retract, then return freshly. Agent
  approval writes are refused with the policy both present and absent.
- [x] Finish integrating owned host loading, catalog reporting and approval
  write reservations, including policy absence and reactivation.
- [x] Add maintained alternate-layout and non-notebook counter fixtures.
  The counter's headless test passes with Vault/Directory/Ops absent.
- [x] Run the non-notebook browser workflow: all seven steps pass, including
  server reads, increment and reload with Vault/Directory/Ops absent.
- [x] Pass the alternate-layout browser workflow: all 17 steps pass after
  fixing stream setup, location naming, chat provider ownership and scoped
  keyboard readiness.
- [x] Finish removing indirect notebook dependencies from the permanent browser
  and server hosts, and enforce the final boundary with import fences.
- [x] Complete capability absence/restoration and scoped state integration tests.
  Content, shell, profile and observer cases pass their focused acceptance
  groups; the latest full run's remaining browser case was corrected to use
  its actual sidebar owner.
- [x] Pass the migrated backend tests with actual providers: 137 tests and
  753 assertions across runtime, MCP and independent Markdown metadata. Fix
  missing mark-operation dispatch and scoped pins/capture cell broadcasts
  discovered during integration.
- [x] Pass the combined ownership regression group: 18 tests and 73 assertions
  across Cordis lifecycle, owned loading and Surface composition.
- [x] Implement independently injected server components with their row's
  lifetime and authority; aggregate pending/failure reports and await child
  cleanup. Three focused module-loader tests pass.
- [x] Move MCP ticket policy and adapters, vault configuration/revalidation and
  media/resync HTTP routes out of the permanent server. The server typecheck
  passes; existing ticket release and approval-write regressions pass.
- [x] Verify every canonical operation and edit intent has exactly one declared
  provider. Independent collection projections also pass the existing
  deletion, broken-file and resync differential corpus.
- [x] Give Markdown its own metadata stream. A live test passes frontmatter
  updates and file disappearance with outline handlers absent.
- [x] Restore the inherited deployment title when layout leaves while theme
  remains active. The focused naming lifecycle test passes all 12 assertions.
- [ ] Run full CI for this substantial batch and fix every failure before the
  next batch. The first complete run exposed the failures listed above.

The checklist below remains the full acceptance contract. A moved implementation
above is not a claim that its complete absence/lifecycle requirement is proved.

## Runtime, locations and loading

- [x] Implement scope-owned locations with only `root` permanent, late owners,
  conflict and cycle diagnostics, and stable unrelated contribution identity.
- [x] Give each integration a Cordis activation scope. Bind child declarations
  to their owning entry; drain dependents on withdrawal and reacquire them when
  the owner returns, independently of the plugin's other work.
- [x] Replace the legacy Slots/Faces tables with a typed facade over the renderer
  registry, sharing key reservations, diagnostics and activation lifetimes.
- [x] Support retry of failed integrations without restarting their plugin or
  unrelated entries.
- [x] Generate and load browser-only bundle rows, distinguishing host selection
  from actual browser activation.
- [x] Contain browser chunk failures per row, expose startup diagnostics without
  a renderer, and retry failed entry imports without reloading the page.
- [x] Offer explicit page reload recovery when a retry cannot recover a cached
  failed dependency, preserving successful shared runtime identity.
- [x] Validate dependency-chunk recovery through both inspector and renderer-free
  startup in Chromium, including cached dependency failure and explicit reload.
- [x] Keep the live roster authoritative over a late bootstrap response or failure.
- [x] Document static `/contract` imports and fence them against implementations.
- [x] Move all application-specific slot contracts to their capability owners.
  Native and compatibility registration suites pass 32 tests; discovery reads
  the supplied bundle metadata without retaining a permanent slot catalog.
- [x] Remove permanent application furniture, state and observers from the host.
  Slot consumers now live with layout, sidebar and outlines. Notification,
  pointer suppression, audio and deployment naming follow activation scopes;
  focused lifetime tests cover cleanup and late asynchronous completions.
- [x] Enforce the final host and plugin boundaries across indirect imports too.

## Shell and presentation plugins

- [x] `ui-renderer`: own the Solid root, generic location registry and clock
  factory provider; remove the host clock publication.
- [x] `layout`: own the frame/header implementations and occupy `root`.
- [x] `layout`: own bar geometry and popover factories in its renderer-dependent
  provider scope; remove the host bar publication and `App.furnish` API.
- [x] `layout`: scope viewport, breakpoint, layout preference and CSS observers
  to the root entry activation.
- [x] `layout`: read sidebar and tool contributions through static contracts.
- [x] `layout`: finish extracting geometry/pane state and remove remaining
  notebook implementation dependencies.
- [x] `navigation`: extract routes, addresses, history, open locations, focus,
  commands and palette presentation, keeping its provider independent of layout.
- [x] `sidebar`: own the actual column/rail and their child contribution locations.
- [x] `sidebar`: remove built-in notebook content and remaining implementation
  dependencies; consume files, pins, capture and trash contributions.
- [x] `preferences`: contribute UI through `layout.tools` and own
  `preferences.sections`.
- [x] `chat`: own fresh alert state and scoped storage listeners independently
  of the shell, and contribute Alerts/Sound through `preferences.sections`.
- [x] `preferences`: move remaining Notes/Done controls to their content owner.
- [x] `theme`: own fresh theme/font/size state, storage observers and scoped DOM
  presentation, independently of preferences; contribute controls separately.
- [x] `theme`: restore prior HTML attributes and palette metadata, revoke icon
  URLs and detach listeners on withdrawal; reread storage on reactivation.
- [x] `theme`: finish ownership of shared appearance build assets and early boot
  code.
- [x] `plugin-inspector`: extract switches, dependency/failure reports and retry
  UI behind host-management services; scope panel and approval-reading state.

## Content and feature plugins

- [x] `outlines`: extract server bindings, readings, operations and wire adapters,
  preserving existing unprefixed tags and vault write authority.
- [x] `outlines`: extract browser models, node routes, tree editor, selection,
  undo, drag-and-drop, property editing and extension points.
- [x] `markdown`: independently extract server/document readings and wire adapters.
- [x] `markdown`: extract document state, routes, rendering, headings and existing
  editing interactions.
- [x] `files`: extract browsing and creation UI over registered file-type
  capabilities, without requiring either content plugin.
- [x] `pins`: extract readings, navigation, commands and shelf presentation.
- [x] `capture`: extract inbox readings, navigation, commands and presentation.
- [x] `trash`: extract readings, route, navigation entry and restore actions.
- [x] `vault-plugins`: extract discovery, version approval, compilation, browser
  chunk publication and loading policy behind a narrow host-loading capability.
- [x] Bind chat's delivery/engine child locations and camera observer to its
  panel entry lifetime.
- [x] Move property extensions and node-reference behavior to outlines; make
  journal date links and Markdown document links independent integrations.
- [x] Preserve bundle/profile selection and all three plugin flags, including
  headless domain providers and exact minimal test configurations. The focused
  profile, independent metadata and policy group passes 18 tests/116 assertions.

## Validation and merge acceptance

- [x] Test location reservations, duplicate occupants/declarations, contract
  disagreement, cycles and failed acquisition rollback.
- [x] Test effectful dependent withdrawal, asynchronous/failed cleanup, hanging
  initialization, fresh reacquisition and unrelated identity preservation.
- [x] Cover optional chunk failure, renderer/bootstrap diagnostics and cold-start
  recovery without page reload in e2e.
- [x] Cover layout/renderer withdrawal while headless vault and MCP remain usable,
  including release of layout styles and viewport observers.
- [x] Cover sidebar removal/restoration while preserving an active editor,
  caret and saved draft.
- [x] Cover theme/preferences independent lifetimes and cross-tab storage updates
  in e2e; test listener, metadata and icon cleanup and failed initialization.
- [x] Validate appearance storage updates with layout or renderer absent.
- [x] Prove outlines with Markdown disabled, and Markdown with outlines disabled,
  in the browser, including exact startup rosters that never activate the other
  content provider.
- [x] Confirm independent headless profile acceptance: scoped provider tests
  cover omitted outlines, preserved Markdown metadata and writes, outlines
  without Markdown, exact selections and all three CLI flag forms.
- [x] Maintain an alternate-layout fixture using unchanged content plugins;
  all 17 browser steps pass.
- [x] Maintain a tiny non-notebook capability with a shell and headless, using
  the same host without Olai domain services.
- [x] Prove surviving drafts, navigation and component state across unrelated
  feature flips, with fresh state for re-enabled departed capabilities.
  Content acceptance passes 28 scenarios / 543 steps; relocated slot renderers
  pass 2 scenarios / 38 steps, and independent startup passes 2 / 16.
- [x] Prove property links and file handlers appear/retract with their providers.
- [x] Prove authorized non-UI host management remains usable with inspector off,
  and preserve inspector state across shell replacement.
- [x] Prove dynamic-plugin version checks, approval, scope ownership and write
  fences survive extraction; unloading their owner retracts contributions
  without undoing emitted vault writes. Policy tests pass, and the full
  service-sharing browser scenario passes all 33 steps after report refresh.
- [x] Complete mobile, history, cancellation, failed/hanging cleanup and observer
  leak coverage across the extracted capabilities. The revised resize feature
  passes all three scenarios/48 steps, proving both owner cancellation and
  unrelated-provider preservation; existing content and native-scope groups
  cover phone confirmations, pending writes and failed cleanup.
- [x] Fix the parked-draft failure reproduced from `keyboard_editing.feature:129`:
  clicked slots own focus and retain their input across activation. A temporary
  visual fallback keeps the input present between the create reply and page
  frame; deferred blur checks distinguish DOM removal from click-away.
  Local browser coverage passes for both handoff timings, input identity,
  actual click-away and a skeleton surviving an unrelated plugin rebuild.
- [x] Investigate the keyboard-status failure after moving a row at `8f077cd7`.
  A controlled DOM removal/refocus test reproduces the same failure with the
  historical synchronous blur handler and passes with the deferred handler.
  Both the original scenario and the new deterministic regression pass.
- [x] Keep assignment controls busy until the session handoff replies. Both the
  held-reply regression and original migration scenario passed at `05dabd441`.
- [x] Reproduce the zero-initial-contract assignment race and prove the guard
  prevents it. `assignment-order.test.ts` stages the actual binding write with
  Deferred, over the scoped Chat and a real ACP echo subprocess: sending before
  ownership is published produces zero contracts; waiting for the assignment
  reply produces exactly one migration contract in both transcript and actual
  agent prompt. This reproduces the symptom seen at `3a8629ad`; the old run had
  no event trace identifying its precise interleaving. The original browser
  scenario and held-reply regression also pass.
- [x] Finish plugin, architecture, profile/running and dynamic-plugin docs for
  the final ownership and absence behavior, including exact selections and
  independently owned slot contracts, renderers and source policy.
- [ ] Pass the complete PR's required checks and acceptance coverage. A green
  existing suite alone does not establish Phase 18 completion.
