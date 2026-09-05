# Phase 18 implementation checklist

Phase 18 is in progress. The acceptance contract is the September 5 proposal
in `oss.olai/brainstorming/cordis-for-olai.md`. This work must land as one
complete PR; intermediate commits are not separately complete phases.

Checked items describe implemented work or specific passing coverage. A plugin
with remaining unchecked items is not fully extracted. All acceptance items must
be complete before this PR is ready to merge.

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
  a renderer, and retry failed imports without reloading the page.
- [x] Keep the live roster authoritative over a late bootstrap response or failure.
- [x] Document static `/contract` imports and fence them against implementations.
- [ ] Move all application-specific slot contracts to their capability owners.
- [ ] Remove permanent application furniture, state and observers from the host.
- [ ] Enforce the final host and plugin boundaries across indirect imports too.

## Shell and presentation plugins

- [x] `ui-renderer`: own the Solid root and generic location registry.
- [x] `layout`: own the frame/header implementations and occupy `root`.
- [x] `layout`: scope viewport, breakpoint, layout preference and CSS observers
  to the root entry activation.
- [x] `layout`: read sidebar and tool contributions through static contracts.
- [ ] `layout`: finish extracting geometry/pane state and remove remaining
  notebook implementation dependencies.
- [ ] `navigation`: extract routes, addresses, history, open locations, focus,
  commands and palette presentation, keeping its provider independent of layout.
- [x] `sidebar`: own the actual column/rail and their child contribution locations.
- [ ] `sidebar`: remove built-in notebook content and remaining implementation
  dependencies; consume files, pins, capture and trash contributions.
- [x] `preferences`: contribute UI through `layout.tools` and own
  `preferences.sections`.
- [ ] `preferences`: move Notes/Done/Alerts controls to feature-owned integrations.
- [x] `theme`: own fresh theme/font/size state, storage observers and scoped DOM
  presentation, independently of preferences; contribute controls separately.
- [x] `theme`: restore prior HTML attributes and palette metadata, revoke icon
  URLs and detach listeners on withdrawal; reread storage on reactivation.
- [ ] `theme`: finish ownership of shared appearance build assets and early boot
  code.
- [x] `plugin-inspector`: extract switches, dependency/failure reports and retry
  UI behind host-management services; scope panel and approval-reading state.

## Content and feature plugins

- [ ] `outlines`: extract server bindings, readings, operations and wire adapters,
  preserving existing unprefixed tags and vault write authority.
- [ ] `outlines`: extract browser models, node routes, tree editor, selection,
  undo, drag-and-drop, property editing and extension points.
- [ ] `markdown`: independently extract server/document readings and wire adapters.
- [ ] `markdown`: extract document state, routes, rendering, headings and existing
  editing interactions.
- [ ] `files`: extract browsing and creation UI over registered file-type
  capabilities, without requiring either content plugin.
- [ ] `pins`: extract readings, navigation, commands and shelf presentation.
- [ ] `capture`: extract inbox readings, navigation, commands and presentation.
- [ ] `trash`: extract readings, route, navigation entry and restore actions.
- [ ] `vault-plugins`: extract discovery, version approval, compilation, browser
  chunk publication and loading policy behind a narrow host-loading capability.
- [x] Bind chat's delivery/engine child locations and camera observer to its
  panel entry lifetime.
- [ ] Move property extensions and node-reference behavior to outlines; make
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
- [ ] Maintain a tiny non-notebook capability with a shell and headless, using
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
- [ ] Investigate intermittent keyboard/draft e2e failures: parked-draft ordering
  in `keyboard_editing.feature:129` failed at `3a8629ad`, and keyboard status after
  moving a row failed at `8f077cd7`. Passing reruns alone do not explain them.
- [ ] Investigate the agent-migration contract failure in
  `node_agents.feature:377`: the browser rerun at `3a8629ad` observed zero initial
  contract messages instead of one. The draft-ordering scenario passed that run;
  five of six browser shards passed, so validation is still incomplete.
- [ ] Finish plugin, architecture, profile/running and dynamic-plugin docs for
  the final ownership and absence behavior. Existing extracted rows have docs.
- [ ] Pass the complete PR's required checks and acceptance coverage. A green
  existing suite alone does not establish Phase 18 completion.
