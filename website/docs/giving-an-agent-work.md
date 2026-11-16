# Giving an agent work

Hand a conversation a row, a file, a quote or a picture, and read what the agent changed.

## What an agent may touch

olai gives an agent no access to your files, only a fixed set of tools, each naming one row of an outline, one whole document or the Trash.[^tools] Every write it makes is checked the way your own edits are.[^validator] It can still edit files by itself,[^own] and can ask you a question.[^ask] **Tools**, above the conversation, lists its tool servers.[^servers]

## Hand it a row, a file or a quote

- Drag a row onto a conversation to attach it to your next message.[^chip]
- Drag a conversation line by its grip to quote its words.[^quote]
- Drag a file from the sidebar onto a conversation to write its path in.

Dropping fills the message in but does not send it.[^touch]

## Name a file or a row with `@`

Type `@` and a list comes up, narrowed as you type: files first,[^files] then rows.[^nodes] Picking a file writes its path; picking a row writes its id and attaches the row.[^keys] An `@` inside a word, as in `srid@example.com`, opens nothing.[^typed]

## Read what the agent did

Each tool call is one line you can unfold.[^fold] A file the agent rewrote shows its changed lines in place.[^diff] A change to an outline is described in words rather than as changed lines, such as *marked done*.[^outline] Ids in the panel are clickable.[^ids]

## Attach a file

Paste a file into the box, drag one onto the panel, or press **Attach a file**.[^camera][^kinds] While a file goes up the box says **attaching…**.[^progress] The file is stored outside the directory olai serves.[^temp]

[^tools]: The tools an agent is given are a fixed list it cannot add to. The outline tools each name one row, or one row with everything under it. The document tools read or replace one whole `.md` file, and `trash_empty` empties the Trash.

    Nothing smaller than a row, a document or the whole Trash can be named, so an agent cannot ask for part of a file through these tools. Every tool is listed in the closed block at the foot of this page.

[^validator]: A write by an agent is checked by the same validator that checks your own edits. A write it refuses comes back as the validator's own messages, each attached to the line it is about. A write that is allowed but worth a second look comes back with advice instead of a refusal.

[^own]: A coding agent edits files on its own authority, anywhere in the directory it was started in, and olai neither grants that nor hides it. An agent that edits an outline file by hand writes the `.olai` format with no validator in front of it. So ask the agent for the change you want rather than for a file edit, and it goes through the tools above.

[^ask]: An agent can ask you a question. The question arrives as a form in the conversation and never times out. Dismissing the form is an answer: the agent is told that you would not say.

[^servers]: The **Tools** list ends with *Plus the agent's own*, because servers set up in the agent's own configuration files are started where olai never looks. Which servers arrive, what each mark beside one means, and what olai says when a server will not start, are in the closed block at the foot of this page.

[^chip]: A row attached to a message is drawn as a chip. Dragging a selection attaches all its rows in the order you picked them, and the rows stay where they are in the outline. Remove a chip with the `×` on it before sending.

    The chip shows the row's title as it is now, and when you send, the server looks up the row's current title, its `file:line` and the titles of the rows it sits under. So renaming the row before you send sends the new title, and a row that was deleted refuses the send.

[^quote]: A finished line of the conversation has a grip at its left edge when you hover it or focus it. Drag that grip onto any conversation to insert the line's words where the cursor is, as a Markdown quote. A line still arriving has no grip.

    The agent's answers and your own messages carry their text. A tool call carries its title and detail, or its reply where it has no detail, and a set of changed lines carries its path and the lines themselves.

[^touch]: With a finger, hold the row, conversation line or file still for a moment, then carry it. Moving before the hold scrolls the page instead. `Escape` cancels a carry.

[^files]: The file half of the `@` list holds every outline, document and saved web page this directory serves, archived files included. A path reads `@notes/cabinets.md`, and `@notes/` works too, because a folder is the start of a path. Each entry shows the file's name with its folder beside it. The list holds eight entries in all, with four places kept for each half.

[^nodes]: The row half of the `@` list is the same search you use elsewhere, run on the server, so `@cab` finds what `cab` finds anywhere else. Search operators such as `@is:blocked`, `@#home` and `@date:today` work ([search](search.md)). Each extra word narrows the search, so `@odu watcher scope` can name one row. Fewer than three characters offers no rows at all. Rows in the Trash are left out, and `@is:trashed` asks for them.

[^keys]: The keys of the `@` list: `↑` and `↓` walk it, through both halves with one cursor. `Tab` takes the entry under the cursor. `Enter` takes the selected entry, and once your query has a space in it no entry is selected, so `Enter` sends the message as you typed it. `Escape` closes the list and leaves your words alone.

[^typed]: A word that matches no file and no row is typed straight through, so `srid@example.com` stays as you wrote it. Undo does not take a completion back: delete the word instead, and the chip goes with it. Typing an id by hand attaches nothing, because only a row you took from the list is attached to your message.

[^fold]: Unfolding a tool call shows the arguments the agent sent and the reply it got. The tools olai hands over show a readable title with the outline beside it, such as “Mark done” and `house.olai`. The agent's own name for the tool stays visible when you hover the line, and at the top of the unfolded call.

[^diff]: A set of changed lines in the conversation shows the file's path, how many lines were added and removed, and the change itself, with unchanged stretches collapsed. It is trimmed to a few lines, and clicking it opens the rest. One edit can draw several of these boxes, one for each place the change landed.

[^outline]: A change to an outline is described in the same words the Commit panel uses: *marked done*, *note rewritten*, *moved*, with the outline it happened in. That describes the file rather than the tool, so an agent that edits a `.olai` file with its own tools gets the same lines. A version of the file that does not parse is described in words, with no changed lines drawn.

[^ids]: Pressing an id in the panel shows you that row. Three things are ids: the chips on your own message, the row a write names, and an id the agent wrote in backticks. A row on another page takes you to that page, unfolded to the row, and a row hidden because it is done is revealed for the visit without changing what that page itself shows.

[^camera]: On a phone, **Take a photo** and **Record a video** open the camera. Each capture joins the strip above the box, and one send carries them all.

[^kinds]: Pictures and documents stop at 50 MB, videos at 200 MB. The agent is given the file's path and nothing else, so a video is not converted or given a thumbnail on the way through. An SVG is taken neither as a picture nor as a document. A transport stream is taken as `.m2ts` only, because a `.ts` file is TypeScript. Every extension olai takes is in the closed block at the foot of this page.

[^progress]: The **attaching…** message carries the share of the bytes the server has acknowledged. A picture shows itself in the strip above the box; any other file shows its name and size. Several files in one drop attach in the order you dropped them, and a file olai will not take is named where you dropped it while the rest of the drop goes on attaching.

[^temp]: The attached file is written to a temporary directory of that conversation's own, which is never inside the directory olai serves, so nothing you attach here can be committed with your outlines. The bytes are deleted when you start a new conversation or stop the server.

<details>
<summary>Every tool an agent is handed</summary>

| Family | What it names |
| --- | --- |
| outlines | search, read a row with everything under it, create an outline, add a row, mark it, retitle it, write its note, schedule it, move it, trash it, mirror it, and set what a row waits on |
| `outlines_update`, `outlines_apply` | several fields of one row as one write; a list of operations over many rows |
| documents | `markdown_index` and `markdown_read` find one document and read it whole; `markdown_create` and `markdown_write` make one and replace its text |
| the Trash | `trash_empty` empties the whole of `_olai/Trash.olai`, and is refused while a row still in use points into it |

Neither document tool names an offset or a range of lines, because a document is handled as one whole text.

</details>

<details>
<summary>Links, clocks, background tasks and the agents an agent sends out</summary>

### A link the agent writes

A link the agent writes behaves like any other link in olai. A document, or an address inside olai, opens in the pane you were last reading, and `Alt` + click opens it in a pane to the right. An `https://` link opens in a new browser tab.

### How long a call has been running

A call that has been running for more than a few seconds says how long on its own line, in seconds and then in minutes (`47s`, `1m 12s`, `1h 20m`). Any call that has not come back yet gets that number, so a shell command, a build, a search and a tool olai has never seen all get one.

The count stops when the call's turn stops, so a line left behind by a turn that died keeps the last time it showed.

### When the agent leaves something running

Some calls answer at once and keep working in the background, such as a monitor or a shell command sent off to run on its own. The line that started one stays live, showing the description the task was started with, how long it has been running, and **Still running…** under it. There is no terminal pane for it, because the exit code the launch returned is not the task's own.

While a task is running it is listed on the **Still running** strip above the conversation, which stays in place as you scroll. When the task ends, the strip clears and a new line arrives at the bottom of the conversation in the agent's own word for it: *completed*, *failed*, *killed* or *stopped*. The line that started the task keeps the ending it already had.

A turn ending leaves such a task running; the agent dying abandons it. Only Claude Code reports background tasks. On another agent a background command is drawn as a call that finished the moment it started.

### When the agent sends other agents

An agent can send out agents of its own. Their calls do not join the conversation: the main column stays the main agent's. The call that sent an agent out keeps its place in the column, its ending, and that agent's report inside its fold.

Under that call, a line says the agent is working, and a button says how many calls it has made. Press the button and that agent's work opens in a panel above the conversation, with the same lines, folds, changed lines and timings it would have had in the main column. The button appears once there is something to show.

While a sent agent is working it is listed on the **Still running** strip, saying what it was sent to do and how long it has been working. You can press it there to open the same panel. A background task on that strip is not clickable, because olai cannot read what it is doing.

A question from a sent agent appears in the conversation rather than in that panel, drawn under a line of its own that names what the agent was sent to do. The panel carries a line saying a question is waiting, and pressing that line takes you to the form.

An agent that dies says so at the bottom of the conversation, in the word the agent's own harness used, or as *ended (never reported back)* where the turn ended while it was still working. An agent that finished normally says nothing there, because it has reported inside the fold of the call that sent it.

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
| none | olai handed the server over and nothing has reported on it |
| × | the server did not connect to this chat, or is missing from it |

| Server | What it brings | When it arrives |
| --- | --- | --- |
| `olai` | the outline, document and Trash tools above, plus [mail](plugins/mail.md)'s reads, labels and drafts | always |
| `kolu` | the terminals this host's [kolu](plugins/kolu.md) daemon is running | when the daemon answers |
| `odu` | the run commands of [odu](plugins/odu.md), such as `run_start` and `run_wait` | when `odu` on the server's path answers |
| `browser` | the [browsing](plugins/browsing.md) plugin's Playwright tools, which drive the browser olai runs for this directory | when its executable answers the probe |

A server that olai would have handed over but could not start gets its own line under the list: its name, the reason the probe or the server gave, and the file that was probed. The reason is the point, because every failure looks the same from the agent's side. olai probes once per conversation, so starting a daemon is enough, and the next conversation you open has its tools.

A machine that is simply not running one of these sees nothing about it. Two cases do put an absence on screen: `PADI_SOCKET` being set means somebody said kolu should be here, and every documented way of starting olai puts `odu` on the server's path, so a server that cannot find it says so.

An agent's own report never overrules olai's probe. Where this host's `kolu` would not answer, the conversation was never given one, so an agent that reports a `kolu` is reporting one of its own.

</details>
