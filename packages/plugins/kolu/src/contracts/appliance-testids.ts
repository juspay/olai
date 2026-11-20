/**
 * This module imports nothing, and must not — a testid door that
 * pulled a component would put SolidJS and an emulator on the graph of a
 * cucumber process with no browser in it.
 */
export const TESTID = {
  terminalBlock: "terminal-block",
  terminalSays: "terminal-says",
  terminalPane: "terminal-pane",
  terminalLive: "terminal-live",
  terminalScreen: "terminal-screen",
  terminalRefetch: "terminal-refetch",
  eventsFeed: "events-feed",
  eventsRow: "events-row",
  eventsWords: "events-words",
  eventsEmpty: "events-empty",
} as const
