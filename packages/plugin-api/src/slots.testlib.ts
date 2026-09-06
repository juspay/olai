/** Compatibility tests explicitly declare their own fixture catalog. */
import { slotContract, type SlotDefinition } from "./slots.ts"
export const TEST_SLOTS = [
  slotContract<unknown>("outline.row.chip","kind"),
  slotContract<unknown>("outline.row.pane","kind"),
  slotContract<unknown>("outline.row.block","kind"),
  slotContract<unknown>("outline.row.door","nothing"),
  slotContract<unknown>("outline.row.action","nothing"),
  slotContract<unknown>("app.route","nothing"),
  slotContract<unknown>("sidebar.entry","nothing"),
  slotContract<unknown>("sidebar.section","nothing"),
  slotContract<unknown>("app.panel","app"),
  slotContract<unknown>("app.header","plugin"),
  slotContract<unknown>("app.banner","plugin"),
  slotContract<unknown>("app.viewer","app"),
  slotContract<unknown>("app.keys","nothing"),
  slotContract<unknown>("app.command","nothing"),
  slotContract<unknown>("app.palette","nothing"),
  slotContract<unknown>("app.mount","plugin"),
  slotContract<unknown>("delivery.mark","plugin"),
  slotContract<unknown>("engine.install","plugin"),
]

declare module "./slots.ts" {
  interface SlotDefinitions {
    "outline.row.chip": SlotDefinition<any,"kind">
    "outline.row.pane": SlotDefinition<any,"kind">
    "outline.row.block": SlotDefinition<any,"kind">
    "outline.row.door": SlotDefinition<any,"nothing">
    "outline.row.action": SlotDefinition<any,"nothing">
    "app.route": SlotDefinition<any,"nothing">
    "sidebar.entry": SlotDefinition<any,"nothing">
    "sidebar.section": SlotDefinition<any,"nothing">
    "app.panel": SlotDefinition<any,"app">
    "app.header": SlotDefinition<any,"plugin">
    "app.banner": SlotDefinition<any,"plugin">
    "app.viewer": SlotDefinition<any,"app">
    "app.keys": SlotDefinition<any,"nothing">
    "app.command": SlotDefinition<any,"nothing">
    "app.palette": SlotDefinition<any,"nothing">
    "app.mount": SlotDefinition<any,"plugin">
    "delivery.mark": SlotDefinition<any,"plugin">
    "engine.install": SlotDefinition<any,"plugin">
  }
}
