# @olai/surface

This package provides the permanent process-management surface and inert shared wire schemas. It does not declare the Olai application's collections, search streams, editor commands, or vault-source approval API.

`src/core.ts` declares the plugin roster, the runtime activation switch, viewer identity, and application identity. These remain available without a vault, an outline renderer, or an inspector. Kolu supplies its reserved identity, liveness, and clock members. `./host` exports the same descriptor object, so adapters do not reconstruct equivalent schemas on separate identities.

Capability packages own their descriptors beside their handlers. Vault declares file heads, load state, and errors; outlines declares tree/page readings and node operations; Markdown declares documents and document metadata; search declares its query stream and procedure; pins and capture declare their readings; files and trash declare their write contributions; vault-plugins declares source approval and inspection. Loading one of those static contracts acquires no plugin state. Activating the provider registers its handlers, and withdrawing it removes their authority.

The `./dispatch` door contains only shared write envelopes: `Edit`/`Applied` and `WriteRequest`/`WriteResult`. Several capabilities own disjoint variants on preserved root tags. They share the same schema objects so composition can prove descriptor compatibility; each registration separately declares its accepted discriminators. Sharing an envelope grants no authority to execute another provider's variant.

The other exports are immutable schemas and pure protocol helpers used on both sides: page readings, edit values, paths, rendering metadata, attachments, and publication projections. Historical `CorePageRequest` and `CorePageReading` names remain schema compatibility names; they do not declare a permanent host endpoint.

`./client` builds a typed face from a supplied surface and dispatch. It has no fixed application spec. The Olai bundle owns its complete static client contract under `@olai/bundle/surface` and `@olai/bundle/client`; application CLI consumers can intentionally use it. MCP owns the smaller tool contract it projects. Browser capabilities consume their own scoped sibling clients, supplied by `Wired`, rather than a permanent full-application client.

Tests pin the permanent management member set here. The bundle's application-contract test checks preserved member tags, read-only declarations, collection semantics, and schema array keys across the capability-owned descriptors.
