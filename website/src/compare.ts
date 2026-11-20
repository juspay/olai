type Own = { text: string }
type Cited = { text: string; source: string }

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
    label: "What it is",
    olai: { text: "An app for a directory of notes. It edits Markdown documents and outlines, and it shows HTML pages, tables, pictures, and PDFs." },
    obsidian: { text: "Markdown notes that link to each other", source: "https://obsidian.md/" },
    logseq: { text: '"A privacy-first, open-source knowledge base"', source: "https://logseq.com/" },
    roam: { text: '"A note taking tool for networked thought"', source: "https://roamresearch.com/" },
    workflowy: { text: '"A single bullet list does it all"', source: "https://workflowy.com/" },
  },
  {
    label: "Where your notes are stored",
    olai: { text: "Plain files in a directory on your computer, in open formats. Documents are Markdown. Outlines are JSON, one item per line." },
    obsidian: { text: "Markdown files on your device", source: "https://obsidian.md/" },
    logseq: { text: "Markdown or Org-mode files. A database version is in beta.", source: LOGSEQ_REPO },
    roam: { text: "Online with Roam, or stored locally", source: "https://roamresearch.com/" },
    workflowy: { text: "In your Workflowy account", source: "https://workflowy.com/" },
  },
  {
    label: "Cost and source code",
    olai: { text: "Free. Open source." },
    obsidian: { text: "Free. Obsidian keeps the rights to the code of the app.", source: "https://obsidian.md/license" },
    logseq: { text: "Free. Open source.", source: LOGSEQ_REPO },
    roam: { text: "Paid, after a free trial", source: "https://roamresearch.com/" },
    workflowy: { text: "Free up to a monthly limit, and paid above it", source: "https://workflowy.com/" },
  },
  {
    label: "Sync and history",
    olai: { text: "History in git. With auto commit and auto push turned on, your notes sync between computers through a git remote. A git conflict needs a terminal." },
    obsidian: { text: "Obsidian Sync, a paid service, keeps up to one year of version history", source: "https://obsidian.md/sync" },
    logseq: { text: "Logseq Sync for the database version, paid or self-hosted", source: `${LOGSEQ_DB}#sync` },
    roam: { text: "Online. People can edit together at the same time.", source: "https://roamresearch.com/" },
    workflowy: { text: "Syncs across web, desktop, and mobile", source: "https://workflowy.com/" },
  },
  {
    label: "AI",
    olai: { text: "Built in. You chat with the agent that you choose, on any item or document." },
    obsidian: {
      text: "A community plugin runs Claude Code, Codex, and other agents in a vault",
      source: "https://community.obsidian.md/plugins/grimoire",
    },
    logseq: { text: "An optional MCP server lets AI programs connect to the database version", source: `${LOGSEQ_DB}#mcp-server` },
    roam: { text: "AI assistants can connect to the graphs that you allow", source: "https://mcp.roamresearch.com/manage" },
    workflowy: { text: "Optional AI features that use OpenAI and Anthropic models", source: "https://workflowy.com/ai-terms/" },
  },
  {
    label: "On a phone",
    olai: { text: "No app. The web page works in a phone browser if the phone can reach your computer." },
    obsidian: { text: "iOS and Android apps", source: "https://obsidian.md/download" },
    logseq: { text: "Mobile apps", source: LOGSEQ_REPO },
    roam: { text: "iOS and Android apps", source: "https://roamresearch.com/" },
    workflowy: { text: "iOS and Android apps", source: "https://workflowy.com/" },
  },
  {
    label: "How you start",
    olai: { text: "A terminal and Nix, on a Mac or a Linux computer" },
    obsidian: { text: "Download the app", source: "https://obsidian.md/download" },
    logseq: { text: "Download the app", source: LOGSEQ_REPO },
    roam: { text: "Sign up in a browser", source: "https://roamresearch.com/" },
    workflowy: { text: "Sign up in a browser", source: "https://workflowy.com/" },
  },
]

export const sourcesOf = (key: Other): ReadonlyArray<string> => [...new Set(ROWS.map((row) => row[key].source))]
