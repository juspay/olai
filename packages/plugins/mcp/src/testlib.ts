export * from "./endpoint.ts"
export * from "./route.ts"
export * from "./tools.ts"

export { ticketing, type Ticket } from "./tickets.ts"

/** THE ROOTED BUNDLE'S TWO HALVES, so a bench can build the very bundle the row
 *  builds. It was `mcpContract` + `AGENT_EXPOSE` + `McpClient` — one flat
 *  curated spec, one hand-written expose map beside it, and one client over the
 *  bare names — until #546 deleted the curation and juspay/kolu#2234 deleted the
 *  need for it. There is no flat contract to re-export any more, and a bench
 *  that wants the served face's shape asks these for it. */
export { clientsFor, ownerIn, runnerIn, siblingsOf, type Row } from "./bundle.ts"
/** `liveDispatch`, `liveClient`, `toOwner` and `Route` were here. A client is
 *  built PER SIBLING now and its dispatch is scoped to that one row, so there is
 *  no route to hand in and no one flat client to hold. */
export { scopedTo, type Reading } from "./live-client.ts"
