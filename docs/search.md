# Search

One query language, five doors. An agent asks `search_nodes` over MCP; a person types into the **search box in the header**, or into the `⌘K` palette — and on a phone, where the bar has no room for a box, taps the magnifier, which opens that same palette. The fourth is different in kind and the same in meaning: the **filter over the page**, which takes rows away from whatever is in front of you instead of listing hits somewhere else — an outline, a zoomed node, a day, the agenda, the trash. The fifth is smaller and is the same grammar again: the chat composer's `@` list, where a word after the sigil NAMES one node to put in a message ([chat.md](chat.md)) — one token of the grammar, because a completion may not swallow the sentence around it.

The first three are callers of one function over one snapshot (`@olai/ops`' `Query.search`). All five are gated by one matcher, `@olai/format`'s `parseFilter` / `matching` — so what an agent finds and what a person finds cannot drift, and `is:done` means one thing everywhere. The two that run in the browser share the ORDER as well (`ranked`: a finished node loses ties), for the same reason one door further on — a list ranked one way in the palette and another way in the composer would be two opinions about one directory. The browser holds every node and could grep them itself; it deliberately does not.

One matcher was never quite the whole of it, because the question and the answer were SPELLED twice — once as the wire spec a browser compiles against (`@olai/surface`), once as the reader the ops layer answers with — and neither package may import the other. They are now one declaration on the floor both stand on (`@olai/format`'s `searching.ts`, over the situated node every read of the set answers with — `reading.ts`'s `Found`), so a field reaches every door or none. It used to reach the agent's and be dropped on the way to the person's, silently — which is why `file`, `under`, `matched` and `refusals` are declared once here rather than four times across two packages.

## What matches

**Words** are case-folded substrings over four fields — title, id, inline tags, note — and every word the query names has to be found somewhere in the same node, unless an `OR` joins it to an alternative (below), where one of the two is enough. A tag is indexed twice, bare and as written, so `alice` finds `@alice` and `@alice` finds only the one with that sigil.

**A quoted phrase is one substring where two words are two.** `"kitchen remodel"` is that line, looked for in the same four fields and weighted the same way; `kitchen remodel` is two substrings that may sit anywhere in the node, in either order. So quoting is how the ORDER of the words gets into a query, and it is the whole of what it does — the tokenizer stops ending a token at a space, and the matcher goes on doing exactly what it did. It negates like any other token — `-"kitchen remodel"` takes those rows back out — and two things follow rather than being ruled: a phrase is a substring of the field's own text, so it does not cross the line break a note keeps; and an id or a tag can hold no space, so a phrase with one is never found in either. (The dash goes outside the quotes. Inside them it is a character, which is how `"-force"` is searched for.)

**A quoted token is text, and never an operator.** `"is:done"` finds the note where somebody wrote that down, and it is the only way to ask for the spelling of something this grammar has claimed. What the FRONT decides is only that — whether the token is text; a quote opens a region wherever it sits, and that region still has to be closed. Which is how a value with a space in it is written (`prop:stage="in review"`) and why a lone `"` is refused wherever it sits, `36"` included (see the refusals, below).

**`OR` joins the tokens on either side of it, and binds TIGHTER than the space between them.** That space is the AND this grammar has always had, so `#home kitchen OR bathroom` is `#home` and one of the other two. Read the other way round it is `(#home and kitchen)` or every bathroom in the directory — a query that quietly WIDENED, which is worse than one that finds nothing, because rows arriving with none of what you asked for look exactly like a search working. A chain is one group (`a OR b OR c`), either kind of token can be an alternative (`is:todo OR is:doing` is work, unfinished), and there are no parentheses: one binding level under the conjunction is a grammar a reader can hold.

**`OR` is in capitals, and it is the one token in the grammar that is not case-folded** — because `or` is a word people write. Lower-case `or` is a word to find, `"OR"` is that word in capitals for a note that shouts it, and the two halves of this pair are each other's escape hatch. **A group is not negated as a group**, and nothing is missing — because the dash is a token's and there are now two binding levels, which is exactly enough for both of De Morgan's readings: `-a -b` is **neither** (`NOT (a OR b)`), and `-a OR -b` is **not both** (`NOT (a AND b)`). So the grammar is closed under both laws without a parenthesis in it, and the only thing a group-level `-` would add is a second way to write one of them.

**Operators** narrow by what a node IS, and compose with the words around them:

| written | selects |
|---|---|
| `is:done` `is:doing` `is:todo` | the mark the node STORES — never a derived one, so a parent whose children are all ticked is not `is:done` unless somebody ticked it |
| `is:marked` | any of the three; `is:marked -is:done` is "work, unfinished" |
| `is:blocked` | what is WAITING: something the node must come after is a task nobody has finished. DERIVED — see below |
| `is:archived` | what was put away — see below |
| `has:desc` `has:see` `has:after` `has:doc` | a field the record carries (an empty edge list is no edge) |
| `has:date` | on any day at all — the unbounded `date:`, so the two cannot disagree |
| `date:2026-08-10` `date:2026-08` `date:2026` | a day, a month, a year |
| `date:today` `date:yesterday` `date:tomorrow` | the day the query is asked on, and the two beside it |
| `date:this-week` `date:last-month` `date:next-year` | `this-` / `last-` / `next-`, with `week`, `month` or `year` |
| `date:a..b` `date:..b` `date:a..` | an inclusive span, either end optional |
| `prop:pr` | carries that custom property at all — `has:` asked of a map with no fixed list of keys |
| `prop:agent=claude-opus` | carries it holding that value; a list matches on any member |
| `-anything` | takes that word or operator back out — ONE leading dash. A second one is a character, not a second negation: `--force` is a word people write, so `--is:done` looks for that text and finds it wherever somebody typed it |

`date:` reads the two dates a journal reads — what the node is scheduled for, and when it was finished. A dated `doing` or `todo` is on no day here, exactly as on the day page ([format.md](format.md)).

**The relative words are twelve, and they are a spelling of a value rather than a second operator.** Three for a day — `today`, `yesterday`, `tomorrow`, because that is the shape English already has — and `this-`, `last-`, `next-` in front of `week`, `month` and `year`. Each resolves to the span it names and is then the same two string comparisons a written date is, which is why they compose with a range wherever one takes a date: `date:last-week..` is everything since Monday week, `date:..today` everything up to tonight, `date:last-month..yesterday` the span between. A month and a year resolve to exactly what their written forms do, so `date:this-month` and `date:2026-08` are one answer in August.

**A week runs Monday to Sunday**, and that is not a second opinion: it is the same count the calendar in the sidebar lays its columns out by. Both read `@olai/format`'s `calendar.ts`, which is the one place in olai a date is counted rather than compared — there is one week convention here, and a query that started its week on Sunday would be selecting days the calendar draws in another row.

**What day it is comes from the ONE clock the door has**: the tab's own local day for the filter the browser parses itself, the server's for the three doors that ask it — the same clock a `done` mark is stamped with. A page left open past midnight re-reads the query against the new day rather than staying on the day it was opened. The resolution is a pure function of the word and that day, which is what lets a test pin the boundaries rather than pass until next Monday.

**The two clocks can disagree, and only across a time-zone boundary.** Usually there is nothing to disagree about — you are reading a directory served from the machine in front of you, and both clocks are that machine's. But a tab open on a phone across a boundary from the server, or on a directory served from elsewhere, has its own local day: for the hours where those days differ, `date:today` typed into the **filter over the page** means one day and the same words typed into the **header box** mean the other. Nothing else in the grammar moves, and the gap is at most one day.

That is accepted rather than papered over. Each door counting from the clock its own reader is standing in is the rule this format already keeps everywhere — a `done` is stamped with a local instant carrying its offset, because a mark belongs to the day the person marking it is having ([format.md](format.md)). The alternative is to put the asker's day on the request, and it costs more than it buys: a day on the wire is a clock the wire has to be trusted about, `search_nodes` grows a field an agent has to fill in to get today, and the server's answer starts depending on whichever browser last asked. The honest reading of a disagreement is the one the doors already give — the filter says what day it is *here*, and the box says what day it is *where the files are*.

`prop:` reads a node's `custom` map ([format.md](format.md)) and nothing else. A field is not a property however much the word looks like one: `prop:done` finds nothing, because a mark is a field and `is:done` is how it is asked about — one way to ask each question. The key and the value are folded like every other token, since a property is something somebody typed into a map that gives no key a spelling. `prop:stage=` is refused rather than selecting nothing: a key holding nothing is a key the file does not carry, so an empty value could only ever be a query that quietly found none.

**`is:blocked` is the one DERIVED value in the grammar**, and what it reads is the derivation the app already draws — the one that dims a row and writes its `blocked by` line ([editing.md](editing.md)). So a query cannot find a node the page does not show as waiting, or miss one it does, and what blockedness IS stays where it is defined rather than being said again here. Two things follow that a reader should not have to look up. It crosses files, because the derivation is of the whole directory. And it is a question about the ORDERING GRAPH where `has:after` is a question about the field — so the two come apart in both directions: `order after demo` with `demo` finished carries the edge and waits on nothing, while a node held up by a `blocks` somebody wrote on the other record is waiting with no `after` of its own to find.

**A known operator with an unknown value is refused**, in the grammar's own words, and the query selects nothing: `is:open` says which values `is:` takes rather than quietly searching for that text and finding none. A colon after anything else (`TODO:`, `http://…`) is an ordinary word — colons occur in prose.

A relative word the vocabulary does not hold joins that contract rather than excepting itself: `date:tomorrowish` is refused, and the refusal says the words the way they are built — the three day words, then the prefixes over the units — the same rule that makes `date:soon` say which values `date:` takes. A range is held to both of its ends, written or relative.

A date that no calendar could hold is refused on the same terms: `date:2026-13`, `date:2026-08-32`. Month 13 is the reader's mistake exactly as `date:soon` is, and the worse of the two to swallow — it *sorts* between December and January, so an empty answer reads as a window rather than as nonsense. The line is what is impossible in **any** month: `date:2026-02-30` is accepted and finds nothing, because telling that from `2026-01-30` needs a calendar, and nothing here parses a date into one.

**A query the grammar cannot READ is refused in the same voice**, and each way of writing one names the rule it broke. `"pick the` is a quote nothing closes, and it is not closed at the end of the line on the reader's behalf: `"pick the` and `"pick the"` are two different queries, and picking one is the quiet answer to a question nobody asked. `kitchen OR` is a joiner missing one of the two things it joins — and since the filter narrows as you type, both of those are what the bar says for the keystrokes in the middle of typing a phrase or a group, exactly as a half-typed `is:` is. `""` — or a phrase of nothing but spaces — joins them from the other end: an empty needle is inside every node ever written, so it is the loud twin of the query that silently finds none, and it is refused for the reason `prop:stage=` is. **The quote rule costs one term, and it is named rather than excepted:** a lone `"` is a quote nothing closes wherever it sits, so `36"` is refused instead of being searched for as an inch mark. The alternative is a second rule about the same character — it opens a phrase unless nothing closes it, in which case it was a character all along — which decides what a token means by reading the end of the line, and the word is reachable without the mark.

**A refusal quotes what you typed**, case and all: the words are matched folded, so `IS:DONE` works, but a refusal for `is:OPEN` says `is:OPEN`.

The refusal reaches **every door**. The filter parses for itself and draws its own; the other three ask the server, so the answer carries `refusals` and the palette and the header box draw them beside their rows. A door that answered `is:open` with an empty list and no reason would be the one place a typo looks exactly like an empty directory.

**Archived nodes are out of every reading unless the query says `is:archived`.** What was put away should stay put away until somebody asks, and `is:archived` is how you ask — at every door, from any page, whatever the page itself is drawing. The one exception is the door whose SCOPE is already showing what was put away: the filter over the **trash** — and over a zoom onto an archived node, which is where such a hit lands — where the default would take away every row and leave nothing to read the absence by ("which pages filter", below). That used to be three pages rather than two: a day and the agenda drew archived rows until the [one-page rule](#the-one-page-rule) took them off.

Title hits outrank id, tag and note; a field that starts with the word beats one that buries it; a done node loses ties. Hits carry `file:line`, the ancestor titles, the mark if the node has one, the node's own `see` / `after` edges, and its `custom` properties — plus `matched`, which field carried the words, absent for a query that named none. Mirrors are never hits — a placement is a second view of a node, not a node.

**Why a hit is there is TWO facts, because both can be true.** `matched` names which of the four word-fields carried the words. `matchedProps` names the custom keys a `prop:` clause selected the node on, in the node's own spelling — absent for a query that named no property, and never naming a negated one, since a node found by `-prop:agent` was not found *on* `agent`. `cabinets prop:agent=claude-opus` sets both, and that is exactly why they are two fields rather than a fifth value of one: `matched`'s four values are a closed list of places a word is looked for, weighted against each other for tie-breaking, where a property key is an open namespace somebody invented — and `matched` being absent already means "the query named no words", which a fifth value would quietly stop meaning.

**A hit carries the properties, so a board is one query.** `prop:agent=claude-opus` answers with each lane's `pr` beside it; `prop:source=inbox` answers with whatever else those nodes were tagged with. Selecting by a property and then reading each hit back to see the fact you selected on was one call plus one per row, which is the shape a query already knew the answer to. The same map reaches a child in `read_node`'s list and a row of `read_subtree`, for the reason `see` and `after` do: one situated node, one set of fields, wherever it is answered.

**The values travel whole** — not cut at a length, not reduced to their keys. A cut value is one no reader can tell from a short one, and the first thing it would cut is the half of a URL that makes it a link; keys alone would hand back the question instead of the answer, and would make `custom` a list on a hit and a map on a read, under one name. The dial on an answer's size is `limit` on the request, and that one is exact — a hit already carries `title` and `path`, which are unbounded prose somebody typed, and a property is a named fact smaller than either.

`search_nodes` also takes a SCOPE: `file` is one outline, `under` is a node and everything beneath it. Those are the two scopes a page can be, so an agent can ask exactly the question a person asks by filtering one.

## Filtering the page in place

Above every page that draws nodes there is a filter box. It is not the header's search box, and the difference is the question: the header takes you TO a node anywhere in the directory, this narrows what is already in front of you.

- **Matches keep their ancestors.** A matching row is drawn with the chain that leads to it and with its own subtree; everything else goes. The context is what makes a bare title like "order" mean something.
- **Clicking a `#tag` or `@mention` filters by it**, ancestors kept, scoped to the page you are on.
- **The filter is in the address** — `?q=…` — so a narrowed page is a link you can send and the back button works. Typing REPLACES the history entry rather than pushing one, so Back leaves the filter rather than un-typing it. Zooming is a navigation and starts unfiltered; Back returns to the narrowed page.
- **Folds are suspended while a filter is on.** A collapse is a claim about the tree you were reading, and honouring it inside a filtered one would hide the match you typed for. Nothing is written: clearing the filter brings every collapse back.
- **Hiding finished work happens first.** The Prefs switch is a standing claim about the reader; the filter is a question about the page. So `is:done` under a done-hiding preference draws nothing — and the bar says how many matches are being held back, rather than leaving it a mystery.
- The bar reports **"3 of 41"**: how many drawn rows are matches, of how many rows the page draws.

### Which pages filter, and what it means on each

**Every page but a document.** The filter shipped on the two tree pages and stopped there for a release; a day, the agenda and the trash drew the same rows out of the same set and ignored the box. They do not any more, and the promise is that there is nothing new to learn — same grammar, same address, same count, same refusal. What differs is only what each page is made of.

| page | what a filter takes away | what stays |
|---|---|---|
| `/o/<file>`, `/n/<id>` | every row that did not match | the matches, their subtrees, and the ancestors that lead to one |
| `/d/<date>`, `/today` | every row that did not match, and an outline heading left with none | the matches — and their ancestry, which was never a row |
| `/agenda` | the same, per day of the spine; a day left with nothing leaves the line, and the silences either side of it close up into one longer wait | the matches, under the days that still hold one — and no line at all when none do |
| `/trash` | the same as a tree, per archive; an archive left with nothing goes | the matches, their subtrees, and the scaffold that says where the pile came from |
| `/doc/<file>` | — no box, and no `?q=` in the address | — |

**A day and the agenda keep no context, and that is not a shortcut.** Their rows are flat and every one already arrives with the crumb that says what it is about, which is what those pages are FOR. So "matches keep their ancestors" is true of every row before a query touches it, and what is left after one is exactly what matched.

**A day's note leaves while a filter is on.** It is a document — prose, which is exactly why `/doc/` is the one address with no `?q=` — so it can never be a match, and a day answering a query with somebody's prose plus no rows would be answering something nobody asked. Clearing the box brings the day back whole.

**The trash searches WITHIN what it shows.** Archived nodes are out of every other reading unless the query says `is:archived` (below) — because those doors are searching the directory. This one is not: it tests the rows in front of you, and the trash IS the archive, so a word typed there finds what was put away. Read-only is a fact about the page's one verb, Put back; it was never a claim that a pile cannot be looked through.

<a id="the-one-page-rule"></a>

**And it is the only page that shows them.** *(Ruled 2026-08-17, reversing what shipped a day earlier.)* **What is archived is drawn on the Trash and nowhere else** — not on a day, not on the agenda, not in the calendar's dots, not on any page but the one that is the archive. A day used to collect every dated node wherever it was filed, and the agenda read those same dates forward, so work put away after somebody scheduled it went on being owed; what that meant in front of a reader is that putting something away did not take it off the page they had put it away from. Archiving is somebody saying they are done looking at a thing, and the Trash is where it is looked at again.

**Reachability is untouched, and that is the other half of the rule.** `is:archived` still selects archived nodes at every door — the agent's `search_nodes`, the ⌘K palette, the header box, and the filter on whatever page you are standing on — and `is:archived date:2026-08-11` still answers with the archived work of that day. What the ruling took away is the DEFAULT presence, never the way to ask. Clicking such a hit opens `/n/<id>` on the archived node, and the filter searches that page the way it searches the pile it came out of.

**What the rule is about is a page's own reading of the set.** Two things still name an archived node on a live page, and both are a reference somebody TYPED rather than a page collecting rows: a **mirror** placed before (or after) the node was put away goes on resolving to it — the archive is one set with the outlines beside it, which is why nothing that pointed at a subtree breaks when it is archived ([the ops layer's own rule](../packages/ops/README.md)) — and a `see` / `after` pill draws its target's title wherever the edge was declared. Whether archiving should retire those too is a ruling about the SET, not about a view, and it is filed with the other one ([brainstorming/editing-web.md](brainstorming/editing-web.md)'s Open) rather than decided by the page that would draw it. Blockedness already answers half of it: an archived target holds nothing up.

So on a day and the agenda there is nothing archived for a query to find or for `-is:archived` to take out, and the page a filter runs on is asked about the archive only when it is drawing some: the trash, a zoom onto an archived node, or a page holding a placement that resolves into the archive. The cost of asking is that a page drawing archived rows has the whole archive in front of the matcher, which is the same whole-set scan every other node already gets.

**A page's own empty sentence is not the filter's.** "Nothing is on 2026-08-10", "Nothing is due.", "The Trash is empty." are claims about the day, the agenda and the archive; "no matches" is a claim about your query, and the bar is where it is made. A filtered page says one or the other, never both.

**What is owed does not move.** The mark beside Agenda in the sidebar counts the unnarrowed reading: a filter is a question about the open page, and what is late is a fact about the directory.

The design, and the alternatives that lost, is [brainstorming/filter-in-place.md](brainstorming/filter-in-place.md).

## What a result row looks like

Two lines, and a third for a node that has properties. The title first, on its own full-width line, cut with an ellipsis if it is long. Underneath, smaller and quieter, where the node lives — written **nearest ancestor first**, because a line that has to be shortened loses its end, and the nearest ancestor is the crumb that answers "which `pick the hinges`?". A node at the top level of its file names the file instead.

**Then the node's properties**, as `key value` pairs — the key in the mono face, the value in the reading face, which is how the drawer under a node's note draws one ([editing.md](editing.md)). A property should look like a property wherever it is drawn. What is not borrowed from the drawer is its two-column grid: that costs a line per property, and a panel showing eight rows cannot spend one. So the pairs run inline on one line that ellipsizes like the other two, and a node with six properties is exactly as tall as a node with one. A node carrying none draws no third line at all — the drawer's own rule on a row, for the drawer's own reason.

**The property you searched by leads, and is drawn in the reading ink rather than the muted one.** That is the row's answer to "why is this here": `prop:agent=claude-opus` puts `agent` at the front of every row, where an ellipsis cannot reach it, and leaves the `pr` beside it readable — which is the whole point of a hit carrying the map. Which key that is comes from the answer (`matchedProps`, below), never from the browser re-reading your query: `-prop:agent` selects the nodes *without* it, and a row that pointed at `agent` there would be drawing a lie the matcher never told.

They are two lines rather than one because a place is somebody's prose. Side by side, the title and the place fight over one row's width: the title loses, wraps to a word per line, and the row ends up five lines tall — and when even that is not enough, the panel scrolls sideways, which a popover must never do.

## Where searching happens on each face

- **Header box** — desktop and up. It sits first in the right-hand cluster and is the one control there that may shrink to nothing, so the connection and commit pills never lose a character to it. Type, arrow up and down, Enter to open, Escape to clear.
- **Phone** — a magnifier in the same place, opening the `⌘K` palette, which is a full-width modal built for exactly this. The bar at 390pt has no room for a box and a phone has no chord to press.
- **`⌘K` palette** — the shell's commands, node results underneath them, and the two things it WRITES: the zoomed node's own verbs, and quick capture on a `+` prefix ([editing.md](editing.md)). Neither is a search — a query carrying `>` or `+` is a line being typed rather than a lookup, and nothing is asked of the server for it.
- **`search_nodes`** — the same answer for an agent, over MCP.

## Not yet: finding a note you cannot name

Searching by MEANING — "the first page load is too heavy" finding a note that never uses those words — is parked rather than shipped. The implementation that was written for it needed a model server (Ollama) running on the reader's machine, and olai requires no dependency outside Nix itself (HACKING.md). It returns when it can be nix-native.
