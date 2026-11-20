export type Upcoming = { words: string; after?: string; issue: number }

export type UpcomingGroup = { heading: string; entries: ReadonlyArray<Upcoming> }

export const UPCOMING: ReadonlyArray<UpcomingGroup> = [
  {
    heading: "For Markdown documents",
    entries: [
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
    ],
  },
  {
    heading: "For the other formats",
    entries: [
      {
        words: "A chat about an HTML page, a CSV file, a picture, a PDF, or a ledger",
        after: ". Today a chat belongs to an item or to a document.",
        issue: 722,
      },
      {
        words: "Search inside an HTML page, a CSV file, a PDF, or a ledger",
        after: ". Today search finds those files by name.",
        issue: 723,
      },
      { words: "Make, edit, and delete for an HTML page", after: ". Today olai shows the page.", issue: 724 },
      { words: "Plain text files", after: ". Today olai does not open a <code>.txt</code> file.", issue: 725 },
    ],
  },
]

export const TRACKING_ISSUE = 726

export const issueUrl = (issue: number): string => `https://github.com/juspay/olai/issues/${issue}`
