# Filtering a page

A row is one line of an outline. Every page that draws rows has a filter box above it: type a query, and rows that do not match go away.[^box]

## Narrow what you are reading

1. Click the box, labelled **Filter** while it is empty. A hint lists the forms a query can take.[^hint]
2. Click one of those forms, or pick one with the arrow keys and `Enter`.[^pick]
3. Type your query, in the language of [search.md](search.md). The page narrows as you type; nothing is submitted.
4. `Escape` puts the hint away and keeps the caret in the box.[^escape]

Clicking a `#tag` or an `@mention` on a row filters this page by it.[^scope] On an outline, the **Finished** box beside the filter shows or hides finished work.[^finished]

## What the bar says

| It reads | It means |
| --- | --- |
| `8 of 57` | 8 of the page's rows match and are drawn |
| `No matches of 57` | your query emptied a page of 57 rows |
| `8 of 57 — 2 more matches hidden as done` | 10 matches on a page of 57 rows |
| `Filtering…` | an answer is on its way[^pending] |

The second number is every row the page holds.[^second]

## Send the narrowed page to somebody

The filter is in the address as `?q=…`, so a narrowed page is a link you can send.[^history] To keep one, press `Cmd` + `K` (`Ctrl` elsewhere) and pick **Pin this page…**.[^pin]

## Why a row is on screen

Each row shows where the query matched.[^guess] A match highlights the word you typed in the title,[^light] a row drawn only for context is dimmed,[^dim] and a row matched on its note shows one line of it.[^note]

## While a filter is on

Every page but a document filters the same way: same query language, address, counts and refusals.[^which] Collapsed rows are opened,[^folds] and the page keeps following the files.[^follow]

[^box]: The filter box takes rows away from the page in front of you. The palette, which **Search** in the header opens, instead takes you to a row anywhere in the directory olai serves.

[^hint]: The hint under the filter box lists the forms a query can take: `words`, `"a phrase"`, `a OR b`, `#tag`, `is:done`, `has:desc`, `date:last-week`, `changed:today`, `-not`.

[^pick]: A form taken from the filter box's hint goes into the box with the part you would replace already selected, so `#tag` arrives with `tag` selected and typing writes over it.

[^escape]: `Escape` in the filter box puts the hint away and keeps the caret in the box. With text in the box, `Escape` empties it.

[^scope]: A row that matches the filter is drawn with the chain of ancestors that leads down to it and with its own subtree, the rows underneath it, which is what makes a bare title like "order" mean something.

[^finished]: The **Finished** box sits beside the filter box on an outline: ticked, it shows finished work on this page, clear, it hides it. Hiding happens first, so `is:done` on a page that hides finished work draws nothing, and the bar says how many matches are being held back.

[^pending]: While `Filtering…` is up the rows in front of you hold still, and a page you have just typed into for the first time is drawn whole until its first answer lands. A call that failed says so on its own line instead.

[^second]: The bar's second number is every row the page holds, whether or not a preference of yours is keeping some off the screen. It does not move when you hide finished work, and the matches held back are counted inside it. A part of the bar that is zero is not said.

[^history]: Typing in the filter box replaces the history entry rather than adding one, so Back leaves the filter rather than undoing your typing one keystroke at a time. Zooming into a row, which opens that row as its own page, is a navigation and starts unfiltered; Back returns to the narrowed page.

[^pin]: Choosing **Pin this page…** asks what to call the pin first. Type a name and press `Enter`, or press `Enter` alone for a pin with no name of its own, drawn as the page's own name with the query beside it.

    A saved search is a row in `Pins.olai` holding a link such as `[What is late](/agenda?q=is%3Atodo)`, so renaming it means editing that row, either from the `✎` button on the pinned list in the sidebar or in the file itself ([documents-and-kinds.md](documents-and-kinds.md)).

[^guess]: A filtered page can be entirely correct and still leave you guessing, because a title that talks about `#deferral` and a title that carries that tag look alike.

[^light]: A match highlights the word you typed where it sits in the title, inside a `#tag`'s pill rather than in place of it. Case is the matcher's own: `cabinets` highlights `Cabinets`, and a bare `home` highlights the name inside `#home`. A query that names no words at all, such as `is:done` or `date:today`, highlights nothing.

[^dim]: A row drawn only as an ancestor of a match, or as part of a match's subtree, is dimmed: it is there for context, and it looks like context.

[^note]: A row matched on its note draws one line of that note under the title, cut off at the end of the line, starting at the line the match is on with the word highlighted. Click that line to open the note.

[^which]: Every page but a document carries a filter box; what differs between them is what the page is made of, which the closed block at the foot of this page lays out.

[^folds]: Collapsed rows are opened while a filter is on, because keeping one collapsed would hide the match you typed for. Nothing is written to the files: clearing the filter collapses them again.

[^follow]: A filtered page keeps following the files. Every revision asks the query again, so a row renamed into the query appears as a match, a row renamed out of it goes, and both numbers move together.

    When the connection to the server drops, the whole app freezes under a card reading **Connection lost** and **Reconnecting…**. The rows the server last answered with stay behind it. The card lifts by itself when the connection comes back, and the filter is asked again against the directory as it then stands.

<details>
<summary>What a filter takes away, page by page</summary>

| Page | What a filter takes away | What stays |
| --- | --- | --- |
| an outline, or a zoomed row | every row that did not match | the matches, their subtrees, and the ancestors that lead to one |
| a day | every row that did not match, and an outline heading left with none | the matches, which never had ancestors on this page |
| the agenda | the same, for each day the agenda lists; a day left with nothing keeps its line | the matches, under the days that still hold one |
| the trash | the same as an outline, within each group the trash lists; a group left with nothing goes | the matches, their subtrees, and the headings saying where the rows came from |
| a document | nothing: prose has no filter box | — |

- A day and the agenda keep no ancestors, because their rows are flat and each already arrives with the trail of ancestors that says what it is about.
- A day's note is not drawn while a filter is on, since prose can never be a match. Clearing the box brings the day back whole.
- The trash searches within what it shows, so a word typed there finds what was put away without `is:trashed`. Trashed rows are drawn on the trash page and nowhere else ([organising.md](organising.md)).
- A page's own sentence for being empty is not the filter's. **Nothing due today**, **Nothing is on 2026-08-12.** and **Trash is empty** are claims about the page; `No matches of 57` is the claim about your query. A filtered page says one or the other, never both.
- The count beside **Agenda** in the sidebar counts the unfiltered agenda: what is late is a fact about the directory, not about the page you are on.

</details>
