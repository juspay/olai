/** Compatibility tests explicitly declare their own fixture catalog. */
import { slotContract, type SlotDefinition } from "./slots.ts"
const FIXTURE = "a test fixture's face"
export const TEST_SLOTS = [
  slotContract<unknown>("outline.row.chip","kind",FIXTURE),
  slotContract<unknown>("outline.row.pane","kind",FIXTURE),
  slotContract<unknown>("outline.row.block","kind",FIXTURE),
  slotContract<unknown>("outline.row.action","nothing",FIXTURE),
  slotContract<unknown>("app.route","nothing",FIXTURE),
  slotContract<unknown>("sidebar.entry","nothing",FIXTURE),
  slotContract<unknown>("sidebar.section","nothing",FIXTURE),
  slotContract<unknown>("app.header","plugin",FIXTURE),
  slotContract<unknown>("app.banner","plugin",FIXTURE),
  slotContract<unknown>("app.viewer","app",FIXTURE),
  slotContract<unknown>("app.keys","nothing",FIXTURE),
  slotContract<unknown>("app.palette","nothing",FIXTURE),
  slotContract<unknown>("app.mount","plugin",FIXTURE),
  slotContract<unknown>("delivery.mark","plugin",FIXTURE),
]

declare module "./slots.ts" {
  interface SlotDefinitions {
    "outline.row.chip": SlotDefinition<any,"kind">
    "outline.row.pane": SlotDefinition<any,"kind">
    "outline.row.block": SlotDefinition<any,"kind">
    "outline.row.action": SlotDefinition<any,"nothing">
    "app.route": SlotDefinition<any,"nothing">
    "sidebar.entry": SlotDefinition<any,"nothing">
    "sidebar.section": SlotDefinition<any,"nothing">
    "app.header": SlotDefinition<any,"plugin">
    "app.banner": SlotDefinition<any,"plugin">
    "app.viewer": SlotDefinition<any,"app">
    "app.keys": SlotDefinition<any,"nothing">
    "app.palette": SlotDefinition<any,"nothing">
    "app.mount": SlotDefinition<any,"plugin">
    "delivery.mark": SlotDefinition<any,"plugin">
  }
}
