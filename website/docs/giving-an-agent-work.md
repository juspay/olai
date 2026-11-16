# Giving an agent work

Hand a conversation a row, a file, a quote or a picture, and read back what the agent did with it.

## What an agent may touch

olai hands an agent no filesystem, only tools naming a node, a whole document or the whole Trash.[^tools] Every write goes through the validator your own edits do.[^validator] What the agent brings with it is its own.[^own] It can also ask you back.[^ask] **Tools** above the transcript lists the servers it was handed.[^servers]

## Hand it a row, a file or a quote

- Drag a row onto a conversation to arm it as a chip.[^chip]
- Drag a transcript row by its grip to quote its words.[^quote]
- Drag a file from the sidebar to insert its served path.

Dropping prepares the message and does not send it; with a finger, hold first, then carry.[^touch]

## Name a file or a node with `@`

Type `@` and the directory comes up, filtered as you type: files,[^files] then nodes.[^nodes] A file writes its whole path into your sentence; a node writes its id and arms a chip.[^keys] An `@` inside a word opens nothing, so `srid@example.com` is an address.[^typed]

## Read what the agent did

A tool call is one folded line.[^fold] A file the agent rewrote shows its diff where it happened.[^diff] An outline gets no diff: it says what changed about the node, in the Commit panel's words.[^outline] Ids in the panel are clickable.[^ids]

## Attach a file

Paste a file into the box, drag one onto the panel, or press **Attach a file**.[^camera] Pictures and documents stop at 50 MB, videos at 200 MB.[^kinds] The composer says **attaching…**.[^progress] The bytes go to a temporary directory of that conversation's own.[^temp]

[^tools]: The tools an agent is handed come in three families. The outline tools name one node or a subtree, the document tools read or replace one whole text, and `trash_empty` empties the Trash. Nothing smaller than a node, a document or the Trash can be named. Every tool is listed in the closed block at the foot of this page.

[^validator]: A write by an agent meets the same validator your own edits do. A refused write comes back as the validator's own rows, pinned to the lines they are about. A write that lands but is worth a second look comes back with advice rather than a refusal.

[^own]: A coding assistant edits files on its own authority, over the directory it was started in, and olai neither grants that nor hides it. An agent editing a `.olai` by hand writes the format with no validator in front of it, so ask for the change rather than for the edit and it goes through the tools.

[^ask]: An agent can ask you back. The question arrives as a form in the conversation and nothing times out. Dismissing one is an answer: the agent is told you would not say.

[^servers]: The **Tools** roster ends with *Plus the agent's own*, because servers configured in the agent's own files are set up where olai never looks. Which servers arrive, what each mark beside one means, and what a server that would not start says, are in the closed block at the foot of this page.

[^chip]: A chip is a node armed on the message. A selection carries all its rows in pick order, and the rows stay where they were. Remove a chip with its `×` before sending. The chip shows the node's live title, and at send time the server resolves the node's current title, its `file:line` and the titles it hangs under. So a rename between arming and sending uses the new title, and a node that was deleted refuses the send.

[^quote]: A settled transcript row has a grip at its left edge on hover or focus. Drag it onto any conversation to insert its words at the caret as a Markdown quote. Answers and your own messages carry their text. A tool row carries its title and detail, or the reply where there is no detail, and a diff carries its path and its changed lines. Streaming rows have no grip.

[^touch]: With a finger, hold the row, transcript line or file first, then carry it; moving before the hold scrolls the page. `Escape` cancels a carry.

[^files]: The file half of the `@` list is every outline, document and saved page this directory serves, archives included. A served path reads `@notes/cabinets.md`, and `@notes/` works too, since a folder is the start of a path. A row reads the file's name with its folder beside it. Four rows are kept for each half.

[^nodes]: The node half of the `@` list is the search you already know, asked of the server, so `@cab` selects what `cab` selects anywhere else, and operators such as `@is:blocked`, `@#home` and `@date:today` work ([search](search.md)). Spaces keep narrowing, so `@odu watcher scope` can name one row. Fewer than three characters offers no nodes. What is in the Trash is not offered; `@is:trashed` asks for it.

[^keys]: The keys of the `@` list: `↑` and `↓` walk it, through both halves with one cursor. `Tab` takes the row under the cursor. `Enter` takes the selected row; with a space in the query no row is selected, so it sends the message as written. `Escape` closes the list and leaves your words alone.

[^typed]: A word matching no file and no node types straight through. Undo does not take a completion back: delete the word instead, and the chip goes with it. Typing an id by hand arms nothing, since only a row you took off the list puts a node on the message.

[^fold]: A tool call's fold holds the arguments and the reply. The tools olai hands over show a friendly title with the outline beside it, such as “Mark done” and `house.olai`. The agent's own spelling for the tool stays on hover and at the head of the fold.

[^diff]: A diff in the transcript shows the path, how many lines came and went, and the change itself, with unchanged stretches collapsed. It is trimmed to a few lines and a click opens the rest. One edit can draw several of these boxes, one per place the change landed.

[^outline]: A change to an outline is said in the same words the Commit panel uses: *marked done*, *note rewritten*, *moved*, with the outline it lives in. That holds for the file rather than for the tool, so an agent that edits a `.olai` with its own tools gets the same rows. A version that does not parse is said in words, with no diff drawn.

[^ids]: Pressing an id in the panel shows you that node. Three things are ids: the chips on your own message, the node a write names, and an id the agent wrote in backticks. A row on another page lands you on that page, unfolded to the row, and a row hidden as done is revealed for the visit without changing the page's own pick.

[^camera]: On a phone, **Take a photo** and **Record a video** open the camera itself, and each capture joins the strip above the box until one send carries them all.

[^kinds]: The agent is handed the file's path and nothing more, so a video is not transcoded or thumbnailed on the way through. An SVG is taken neither as a picture nor as a document. A transport stream is taken as `.m2ts` only, since a `.ts` is TypeScript. Every extension olai takes is in the closed block at the foot of this page.

[^progress]: The composer's **attaching…** carries the share of bytes the server has acknowledged. A picture shows itself in the strip; anything else shows its name and size. Several files in one drop attach in the order you dropped them, and anything olai will not take is named where it was dropped while the rest of the drop still attaches.

[^temp]: The temporary directory is never under the directory being served, so nothing attached here can be committed with your outlines. The bytes go when you start a new conversation or stop the server.

<details>
<summary>Every tool an agent is handed</summary>

| Family | What it names |
| --- | --- |
| outlines | search, read a subtree, create an outline, add, mark, retitle, note, schedule, move, trash, mirror, and wire what a node waits on |
| `outlines_update`, `outlines_apply` | several fields of one node as one write; a list of operations over many |
| documents | `markdown_index` and `markdown_read` find one and read it whole; `markdown_create` and `markdown_write` mint one and replace its text |
| the Trash | `trash_empty` empties `_olai/Trash.olai` whole, and is refused while a live row still points into it |

Neither document end names an offset or a range, because a document is one text.

</details>

<details>
<summary>Links, clocks, background tasks and the agents an agent sends out</summary>

### A link the agent writes

A link the agent writes behaves like any other link in olai. A document or an olai address opens in the pane you were last reading, and `Alt` + click opens it in a pane to the right. An `https://` link opens in a new tab.

### How long a call has been running

A call that has been running for more than a few seconds says how long on its own line, in seconds and then in minutes (`47s`, `1m 12s`, `1h 20m`). What earns a number is the call not having come back, so a shell command, a build, a search and a tool olai has never seen all get one. The clock stops when the call's turn does, so a row a dead turn left behind keeps its last word.

### When the agent leaves something running

Some calls answer at once and keep working: a monitor, or a shell command sent off to run in the background. The row that armed one stays live, with the description the task was armed with, the clock, and **Still running…** under it. There is no terminal pane, because the exit code at launch is not the task's.

While a task is out it is on the **Still running** strip above the transcript, which is never carried away by scrolling. When it ends, the strip clears and a fresh row arrives at the bottom of the transcript in the harness's own word (*completed*, *failed*, *killed* or *stopped*), while the row that armed it keeps its own ending.

A turn ending leaves such a task alone; the agent dying abandons it. Only Claude Code reports this. On another agent a background command is drawn as a call that completed the moment it started.

### When the agent sends other agents

An agent can send agents of its own, and their calls do not enter the conversation: the column stays the main agent's. The call that sent an agent out keeps its place, its ending and the agent's report in its fold.

Under that row, a rail says the agent is working and a door says how many calls it has made. Press the door and that agent's work opens in a shelf above the conversation, with the same rows, folds, diffs and clocks it would have had in the column. The door is drawn once there is something behind it.

While an agent is out it is on the **Still running** strip, saying what it was sent to do and how long it has been gone. An agent there is pressable and opens the same shelf; a background task is not, because its own events reach nothing olai can read.

A question from a sent agent is in the conversation rather than in the shelf, drawn behind its own rail and naming what that agent was sent to do. The shelf carries a line saying a question is waiting, and pressing it takes you to the form.

An agent that dies says so at the bottom of the transcript, in the harness's word, or as *ended (never reported back)* where the turn ended with it still out. One that came back fine says nothing there: it has just reported into the fold of the row that sent it.

</details>

<details>
<summary>What a file attachment may be</summary>

| Kind | Extensions | Cap |
| --- | --- | --- |
| Pictures | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico` | 50 MB |
| Documents | `.pdf`, `.txt`, `.md`, `.csv`, `.json` | 50 MB |
| Videos | `.mp4`, `.m4v`, `.mov`, `.webm`, `.mkv`, `.avi`, `.wmv`, `.flv`, `.mpg`, `.mpeg`, `.3gp`, `.3g2`, `.ogv`, `.m2ts` | 200 MB |

</details>

<details>
<summary>Which tool servers a conversation has</summary>

| Mark | What it means |
| --- | --- |
| ✓ | the agent itself said the server is connected |
| none | olai handed it over and nothing has reported on it |
| × | it didn't connect to this chat, or is missing from this chat |

| Server | What it brings | When it arrives |
| --- | --- | --- |
| `olai` | the outline, document and Trash tools above, plus [mail](plugins/mail.md)'s reads, labels and drafts | always |
| `kolu` | the terminals this host's [kolu](plugins/kolu.md) daemon is running | when the daemon answers |
| `odu` | the run verbs of [odu](plugins/odu.md), such as `run_start` and `run_wait` | when `odu` on the server's path answers |
| `browser` | the [browsing](plugins/browsing.md) plugin's Playwright tools, driving the browser olai runs for this directory | when its executable answers the probe |

A server that would have been handed over and did not work gets its own line under the roster: the name, the reason the probe or the server gave, and the file that was probed. The reason is the point, since every failure looks the same from the agent's side. Detection is per conversation, so starting a daemon is enough and the next conversation has its tools.

A machine that is simply not running one of these sees nothing about it. Two exceptions put an absence on screen: `PADI_SOCKET` being set counts as somebody saying kolu should be here, and every documented way of starting olai carries `odu` on the server's path, so a serve that resolves none says so.

An agent's own report never overrules the probe. Where this host's `kolu` would not answer, the conversation was never handed one, so an agent reporting a `kolu` is reporting one of its own.

</details>
