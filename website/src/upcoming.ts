export type Upcoming = { words: string; after?: string; issue: number }

export const UPCOMING: ReadonlyArray<Upcoming> = [
  {
    words: "Wikilinks",
    after: ". Today olai shows <code>[[page]]</code> as text. A standard link, <code>[page](page.md)</code>, works.",
    issue: 710,
  },
  { words: "Embeds", after: ", such as <code>![[page]]</code>.", issue: 711 },
  {
    words: "Documents beside outlines in the sidebar and on the home page",
    after: ". Today the sidebar lists documents in a section named <strong>Reference</strong>.",
    issue: 712,
  },
  { words: "A document editor with a preview", after: ". Today you edit a document as plain text.", issue: 713 },
  { words: "Task boxes that you can tick in a document", issue: 714 },
  { words: "Rename and move for a document", issue: 715 },
  { words: "Math", issue: 716 },
  { words: "Pictures that you add from the browser", issue: 717 },
  { words: "Tags in a document", issue: 718 },
  { words: "Callouts, highlights, and Mermaid diagrams", issue: 719 },
  { words: "Files named <code>.MD</code>", issue: 720 },
]

export const TRACKING_ISSUE = 721

export const issueUrl = (issue: number): string => `https://github.com/juspay/olai/issues/${issue}`
