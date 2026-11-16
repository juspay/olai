# Filtering a page

Above every page that draws rows there is a filter box. It takes rows away from what is in front of you, where the header's search box takes you to a node anywhere in the directory. The query language is the same one: [search.md](search.md).

## Narrow what you are reading

1. Click the box, which says **Filter** while it is empty. A hint opens under it listing the forms a query takes: `words`, `"a phrase"`, `a OR b`, `#tag`, `is:done`, `has:desc`, `date:last-week`, `changed:today`, `-not`.
2. Click one of those forms, or walk the list with the arrow keys and press `Enter`. It goes into the box with the part you would replace already selected, so `#tag` arrives with `tag` selected and typing writes over it.
3. Type your query. The page narrows as you type; nothing is submitted.
4. Press `Escape` to put the hint away and keep the caret in the box. With text in the box, `Escape` empties it.

Clicking a `#tag` or an `@mention` on a row filters by it, scoped to the page you are on. A matching row is drawn with the chain of ancestors that leads to it and with its own subtree, which is what makes a bare title like "order" mean something.

On an outline, beside the box, is the **Finished** box: ticked shows finished work on this page, clear hides it. Hiding happens first, so `is:done` on a page that hides finished work draws nothing — and the bar says how many matches are being held back.

## What the bar says

| It reads | It means |
| --- | --- |
| `8 of 57` | 8 of the rows the page holds are matches and are drawn |
| `No matches of 57` | the page holds 57 rows and your query emptied it |
| `8 of 57 — 2 more matches hidden as done` | 10 matches on a page of 57 rows |
| `Filtering…` | an answer to what you have typed is on its way |

- The second number is every row the page holds, whether or not a preference of yours is taking some off the screen. It does not move when you hide finished work, and the matches held back are counted inside it.
- A part that is zero is not said.
- While `Filtering…` is up the rows in front of you hold still, and a page you have just typed into for the first time is drawn whole until its first answer lands. A call that failed says so on its own line instead.

## Send the narrowed page to somebody

The filter is in the address as `?q=…`, so a narrowed page is a link you can send.

- Typing replaces the history entry rather than pushing one, so Back leaves the filter rather than un-typing it.
- Zooming into a row is a navigation and starts unfiltered; Back returns to the narrowed page.
- To keep one, press `Cmd` + `K` (`Ctrl` elsewhere) and pick **Pin this page…**. It asks what to call it first: type a name and `Enter`, or press `Enter` alone for the bare pin, drawn as the page's own name with the query beside it.
- A saved search is a row in `Pins.olai` holding a link such as `[What is late](/agenda?q=is%3Atodo)`, so renaming it is editing that row, from the shelf's `✎` or in the file ([documents-and-kinds.md](documents-and-kinds.md)).

## Why a row is on screen

A filtered page can be entirely correct and still leave you guessing, because a title that talks about `#deferral` and one that wears it read alike. So each row says where the query landed.

- A match lights its needle where it sits in the title, inside a `#tag`'s pill rather than instead of it. Case is the matcher's own: `cabinets` lights `Cabinets`, and a bare `home` lights the name inside `#home`.
- A query that names no words at all, such as `is:done` or `date:today`, lights nothing.
- A row drawn only as an ancestor, or as part of a match's subtree, is dim: it is context, and it looks like context.
- A row found behind its note draws one clamped line of that note under the title, opening at the hit's own line with the word lit in it. Click that line to open the note.

## While a filter is on

- Folds are suspended, because honouring a collapse would hide the match you typed for. Nothing is written: clearing the filter brings every collapse back.
- The page keeps following the files. Every revision re-asks the query, so a row retitled into it appears as a match, a row retitled out of it goes, and both numbers move together.
- A wire that cannot carry the question freezes the whole app under a card reading **Connection lost** and **Reconnecting…**. The rows the server last answered stay behind it. The card lifts by itself when the wire comes back, and the filter is re-asked against the directory as it then stands.

## Which pages filter

Every page but a document. The grammar, the address, the count and the refusals are the same on each; what differs is what the page is made of.

| Page | What a filter takes away | What stays |
| --- | --- | --- |
| an outline, or a zoomed row | every row that did not match | the matches, their subtrees, and the ancestors that lead to one |
| a day | every row that did not match, and an outline heading left with none | the matches, whose ancestry was never a row here |
| the agenda | the same, per day of the spine; a day left with nothing leaves its line | the matches, under the days that still hold one |
| the trash | the same as an outline, per archive; an archive left with nothing goes | the matches, their subtrees, and the scaffold saying where the pile came from |
| a document | nothing: there is no filter box on prose | — |

- A day and the agenda keep no ancestors, because their rows are flat and each already arrives with the crumb that says what it is about.
- A day's note leaves while a filter is on, since prose can never be a match. Clearing the box brings the day back whole.
- The trash searches within what it shows, so a word typed there finds what was put away without `is:trashed`. Archived rows are drawn on the trash and nowhere else ([organising.md](organising.md)).
- A page's own empty sentence is not the filter's. **Nothing due today**, **Nothing is on 2026-08-12.** and **Trash is empty** are claims about the page; `No matches of 57` is the claim about your query. A filtered page says one or the other, never both.
- The mark beside **Agenda** in the sidebar counts the unnarrowed reading: what is late is a fact about the directory rather than about the page you are on.
