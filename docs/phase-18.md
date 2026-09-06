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

Current integration: `f5093a416` completed full `just ci`: 34 checks passed and
15 failed. Failures include stale extraction assertions, passive routes opening
a listener without a transport, MCP availability after withdrawal, and browser
workflow regressions. Fixes and focused verification are in progress; the
current working tree is not yet validated by full CI.

GitHub CodeQL also flagged case-sensitive script extraction in the theme asset
test. The regex is corrected and both first-paint tests pass; verification of
the pushed fix by GitHub CodeQL remains pending.

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
  waits for pending-child cleanup. Both focused tests pass. This uncovered and
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
- [ ] Complete capability absence/restoration and scoped state integration tests.
  Seven content browser scenarios and four shell lifetime scenarios are
  authored; focused content checks pass. Backend fixtures now mount actual
  providers and have exposed integration bugs being fixed before full CI.
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
- [ ] Move all application-specific slot contracts to their capability owners.
- [ ] Remove permanent application furniture, state and observers from the host.
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
- [ ] Preserve bundle/profile selection and all three plugin flags, including
  headless domain providers and exact minimal test configurations.

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
- [ ] Prove outlines with Markdown disabled, and Markdown with outlines disabled,
  in both browser and headless profiles.
- [ ] Maintain an alternate-layout fixture using unchanged content plugins.
- [x] Maintain a tiny non-notebook capability with a shell and headless, using
  the same host without Olai domain services.
- [ ] Prove surviving drafts, navigation and component state across unrelated
  feature flips, with fresh state for re-enabled departed capabilities.
- [ ] Prove property links and file handlers appear/retract with their providers.
- [x] Prove authorized non-UI host management remains usable with inspector off,
  and preserve inspector state across shell replacement.
- [ ] Prove dynamic-plugin version checks, approval, scope ownership and write
  fences survive extraction; unloading their owner retracts contributions
  without undoing emitted vault writes.
- [ ] Complete mobile, history, cancellation, failed/hanging cleanup and observer
  leak coverage across the extracted capabilities.
- [x] Fix the parked-draft failure reproduced from `keyboard_editing.feature:129`:
  clicked slots own focus and retain their input across activation. A temporary
  visual fallback keeps the input present between the create reply and page
  frame; deferred blur checks distinguish DOM removal from click-away.
  Local browser coverage passes for both handoff timings, input identity,
  actual click-away and a skeleton surviving an unrelated plugin rebuild.
- [ ] Investigate the intermittent keyboard-status failure after moving a row
  at `8f077cd7`; its cause remains unexplained.
- [x] Keep assignment controls busy until the session handoff replies. Both the
  held-reply regression and original migration scenario passed at `05dabd441`.
- [ ] Establish whether the assignment guard explains the earlier
  `node_agents.feature:377` failure: `3a8629ad` observed zero initial contract
  messages instead of one. The guard closes a concrete race, but passing
  coverage alone does not prove that original failure's cause.
- [ ] Finish plugin, architecture, profile/running and dynamic-plugin docs for
  the final ownership and absence behavior. Existing extracted rows have docs.
- [ ] Pass the complete PR's required checks and acceptance coverage. A green
  existing suite alone does not establish Phase 18 completion.
