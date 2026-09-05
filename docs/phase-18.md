# Phase 18 implementation status

Phase 18 is in progress. The acceptance contract is the September 5 proposal
in `oss.olai/brainstorming/cordis-for-olai.md`. This work must land as one
complete PR; the intermediate commits are not a separately complete phase.

Implemented foundations:

- Scope-owned locations, with only root permanent, late owners, ancestor
  withdrawal, conflict and cycle diagnostics, and stable contribution identity.
- A browser-only `ui-renderer` row owning the Solid root and generic registry.
- A `layout` row owning the frame and header implementations and occupying root.
  Its remaining content-provider coupling is stated in its plugin documentation.
- Bundle generation and loading for rows without server implementations;
  host selection is distinguished from actual browser activation.

Required before this PR can be considered complete:

- Finish extracting layout state and its frame; extract navigation and sidebar
  providers with acyclic integration components. Viewport, breakpoint, layout
  preference and CSS observers now belong to the root entry activation.
- Extract independent outlines and Markdown server bindings, wire adapters,
  browser models, routes and editing/reading state. Preserve unprefixed tags.
- Extract files, theme, preferences, inspector, pins, capture and trash;
  migrate existing integrations and capability-owned property links.
- Extract vault-defined discovery, approval, compilation and chunk loading
  policy behind a narrow generic host-loading capability.
- Remove permanent application-specific contracts and implementations,
  including indirect imports. Migrate existing application slots to owners.
- Prove both content capabilities independently in browser and headless
  profiles, alternate layout and non-notebook fixtures, dynamic write fences,
  lifecycle failures and cancellation, mobile/history workflows and observer
  cleanup. A passing existing suite does not establish these conditions.

The current registry tests exercise waiting descendants, replacement owners,
stable identity, duplicate declarations and occupants, contract disagreement,
cycles, failed acquisition rollback and failed plugin activation cleanup.
They do not establish the complete application boundary above.

Review corrections now give each location integration a Cordis activation;
child availability is offered by its owning entry, and removal drains dependent
resources before that entry closes. Tests cover asynchronous and failed cleanup,
hanging initialization, fresh reacquisition, and unrelated identity preservation.
Browser chunk acquisition is contained per row, with failed loads reported in
the inspector. Cold-start recovery and further shell extraction remain under
active validation; these corrections do not complete Phase 18.
