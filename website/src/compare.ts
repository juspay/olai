type Own = { text: string }
type Cited = { text: string; detail?: string; source: string }

export const OTHERS = [
  { key: "obsidian", name: "Obsidian" },
  { key: "logseq", name: "Logseq" },
  { key: "roam", name: "Roam Research" },
  { key: "workflowy", name: "Workflowy" },
] as const

type Other = (typeof OTHERS)[number]["key"]

export type Row = { label: string; olai: Own } & Record<Other, Cited>

export const READ_ON = "20 November 2026"

const LOGSEQ_REPO = "https://github.com/logseq/logseq"
const LOGSEQ_DB = "https://github.com/logseq/docs/blob/master/db-version.md"

export const ROWS: ReadonlyArray<Row> = [
  {
    label: "Notes",
    olai: { text: "Local files" },
    obsidian: { text: "Local files", detail: "Markdown files on your device", source: "https://obsidian.md/" },
    logseq: { text: "Local files", detail: "Markdown or Org-mode files. A database version is in beta.", source: LOGSEQ_REPO },
    roam: { text: "Online or local", detail: "Online with Roam, or stored locally", source: "https://roamresearch.com/" },
    workflowy: { text: "Online", detail: "Online. They sync across web, desktop, and mobile.", source: "https://workflowy.com/" },
  },
  {
    label: "Cost",
    olai: { text: "Free, open source" },
    obsidian: { text: "Free", detail: "Free. Obsidian keeps the rights to the code of the app.", source: "https://obsidian.md/license" },
    logseq: { text: "Free, open source", source: LOGSEQ_REPO },
    roam: { text: "Paid", detail: "Paid, after a free trial", source: "https://roamresearch.com/" },
    workflowy: { text: "Free tier", detail: "Free up to a monthly limit, and paid above it", source: "https://workflowy.com/" },
  },
  {
    label: "Sync",
    olai: { text: "Git" },
    obsidian: { text: "Paid add-on", detail: "Obsidian Sync, a paid service, keeps up to one year of version history", source: "https://obsidian.md/sync" },
    logseq: { text: "Paid or self-hosted", detail: "Logseq Sync for the database version, paid or self-hosted", source: `${LOGSEQ_DB}#sync` },
    roam: { text: "Built in", detail: "Online. People can edit together at the same time.", source: "https://roamresearch.com/" },
    workflowy: { text: "Built in", detail: "Syncs across web, desktop, and mobile", source: "https://workflowy.com/" },
  },
  {
    label: "AI",
    olai: { text: "Your own agent" },
    obsidian: {
      text: "Plugin",
      detail: "A community plugin runs Claude Code, Codex, and other agents in a vault",
      source: "https://community.obsidian.md/plugins/grimoire",
    },
    logseq: { text: "MCP server", detail: "An optional MCP server lets AI programs connect to the database version", source: `${LOGSEQ_DB}#mcp-server` },
    roam: { text: "MCP server", detail: "AI assistants can connect to the graphs that you allow", source: "https://mcp.roamresearch.com/manage" },
    workflowy: { text: "Built in", detail: "Optional AI features that use OpenAI and Anthropic models", source: "https://workflowy.com/ai-terms/" },
  },
  {
    label: "Phone",
    olai: { text: "No app" },
    obsidian: { text: "iOS and Android", source: "https://obsidian.md/download" },
    logseq: { text: "Mobile apps", source: LOGSEQ_REPO },
    roam: { text: "iOS and Android", source: "https://roamresearch.com/" },
    workflowy: { text: "iOS and Android", source: "https://workflowy.com/" },
  },
  {
    label: "Start",
    olai: { text: "Terminal and Nix" },
    obsidian: { text: "Download", source: "https://obsidian.md/download" },
    logseq: { text: "Download", source: LOGSEQ_REPO },
    roam: { text: "Browser", detail: "Sign up in a browser", source: "https://roamresearch.com/" },
    workflowy: { text: "Browser", detail: "Sign up in a browser", source: "https://workflowy.com/" },
  },
]

export const factsOf = (key: Other): ReadonlyArray<{ label: string; fact: string; source: string }> =>
  ROWS.map((row) => ({ label: row.label, fact: row[key].detail ?? row[key].text, source: row[key].source }))
