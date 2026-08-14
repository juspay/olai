# The chat agent

Open the panel in the corner and tell the agent what you want. Ask it to
check something off and the checkbox in front of you moves — not because the
panel echoed anything, but because the write went to disk, through the same
validator a load runs, and came back on the same subscription every other
change does.

## Which agent

The panel speaks [ACP](https://agentclientprotocol.com), and the default
agent is the pinned Claude Code adapter, which comes with olai: `nix run`,
the packaged binary and `just serve` all default to it, so there is nothing
to install and nothing to configure.

- `OLAI_ACP_AGENT` points at a different ACP agent.
- Setting it to the empty string turns chat off — the panel then says there
  is no agent and which variable would give it one. The outlines are served
  the same either way.

The conversation is the agent's own session for that directory: close olai,
reopen it, and you are back in it — and (for the default agent)
`claude --resume` in a terminal reaches the same conversations.

## Which conversation you come back to

**The one you were in.** Olai writes down which conversation the panel holds and
opens that one again, so a restart puts you back where you were and nothing else
in the directory can take the panel from you: a `claude` you ran in a terminal
here, a `/clear` that started a fresh session beside the one it ended, an agent
that touched a timestamp for a reason of its own. Before this, the panel came up
in whichever session had been written to most recently, which is a different
question with the same answer most of the time and somebody else's conversation
the rest of it.

If that conversation is GONE — you deleted it, or you have pointed olai at a
different agent since — the most recent one in this directory is opened instead,
which is what always used to happen. Whichever you get, the header names it.

The note lives with this machine's other state (`~/.local/state/olai/`, or
wherever `XDG_STATE_HOME` points), never in the directory being served: it is one
id and the path it belongs to, so a directory you serve from two machines
remembers a conversation on each. If it cannot be read or written the panel says
so in the conversation and carries on — a restart then opens the most recent
conversation, which is the old behaviour and a working panel either way.

**chats** lists the stored conversations for this directory, and each row says
when it was last touched, to the minute. That is deliberate rather than decorative:
`/clear` leaves two sessions sharing one name, and the protocol carries no fact
that says which of them replaced the other, so the time is what tells you the row
you mean. Picking one loads it — and makes it the conversation you come back to.

## What it can touch

**Olai hands the agent no filesystem.** What olai itself gives it is a closed
list of tools that can only name nodes — search, read a subtree, create an
outline, add, mark, retitle, note, schedule, move, archive, place a mirror,
retire one, and wire what a node waits on — so the edits it can ask *olai* for
are the edits the format can be, and a malformed outline is not something that
path can produce. When a write is refused, the validator's own rows come back,
pinned to the lines they are about; when a write lands but is worth a second
look, the answer says so — advice about something that happened, never a
refusal.

**What the agent brings with it is its own.** The default agent is a coding
assistant, and a coding assistant edits files: ask it to fix a typo in a `.md`
and it will, with its own tools, on its own authority — the same authority it
has in a terminal, over the directory it was started in. Olai neither grants
that nor pretends it away; what it does is SHOW it, which is the section below.
The one thing worth knowing is that an agent editing a `.jsonl` by hand is
writing the format without the validator in front of it — the outlines are
plain text and nothing stops that — so if you want an outline changed, ask for
the change rather than for the edit, and it goes through the tools.

It can ask you back: when it needs to know which of two things you meant, the
question arrives as a form in the conversation, and nothing times out.
Dismissing one is an answer too — the agent is told you would not say, never
handed a choice you did not make.

## Asking about one node

A row's `•••` menu offers **Ask agent**, and choosing it opens the panel with
that node in the box — a chip above what you type, which you can take off again
before you send. The turn is then about THAT node rather than about whatever
your sentence re-describes: "why is this waiting?" needs no title in it, and two
nodes with the same title are not a thing you have to disambiguate in prose.

What the agent is handed is the node's **id**, with its title, its `file:line`
and the titles it hangs under, as one line under your message — the same
arrangement an attached file gets, and for the same reason: the id is the handle
every one of olai's tools takes, so the agent can read the node, mark it, note
it or move it through the same gate as always. What it is NOT handed is a copy
of the node's contents: a subtree pasted into a prompt stops being true the
moment anything writes, and the agent has `read_node` for the live one.

The chip says the title, but the title is not what is sent. Rename the node
between arming and sending and the agent gets the name it has now; archive it
and the send is refused, in the same words a tool call gets for an id nothing
declares — because a question about a node is not one to ask without it.

## Pointing back at a node

Ids in the panel are pressable, and pressing one shows you that node: the row
scrolls into view and says it is the one being talked about. If it is not on the
page you are reading — another outline, a branch you have collapsed — you go to
its own page instead.

Three things in the conversation are ids, and none of them is a syntax anybody
had to invent:

- the **chips on your own message**, which are the nodes you asked about;
- **what a write changed** — every edit the agent makes through olai's tools
  draws a line naming the node, and that name is the node;
- **an id the agent wrote in backticks**, which is how it spells one anyway,
  because that is how every one of these tools describes its own arguments. A
  backticked word becomes pressable exactly when the outlines you have loaded
  declare it: `notes.md` and `--commit=off` stay what they are. An id that
  names a MIRROR shows you the node it is a placement of — the same place a
  `see` to that mirror lands, and the only one there is: a mirror is drawn
  wherever its target is, and it is the target a row stands for.

## What it shows when it changes something

A tool call is one folded line, and what the call CHANGED is not folded away —
the arguments are what was asked for, and this is what happened to your files.
There are two kinds of change and the panel draws them differently, because they
are different things.

**A file the agent rewrote** — a `.md`, a source file, anything that is not a
node — shows its diff, right there in the conversation: the path, how many lines
came and went, and the change itself, with the unchanged stretches between two
edits collapsed so what you read first is what moved. It is TRIMMED to a few
lines, and a click opens the rest where it stands. That is the one thing the
transcript is for here: an edit like this appears in no outline, so before it was
drawn, the only way to see what an agent had done to a file was a terminal.

**An outline never gets a text diff**, and that is deliberate: an outline is one
line per node, so a text diff of one would be a single enormous line with
everything on it changing at once. What shows instead is what changed about the
NODE, in the same words the Commit panel uses for the same edit — *marked done*,
*note rewritten*, *moved* — with the outline it lives in and, when the rollup
has something to say, its remark underneath. The tree in front of you has
already moved anyway; this is the sentence that says which write did it.

That holds for the file rather than for the tool: an agent that edits a `.jsonl`
with its own tools gets the same node-level rows, read out of the two versions
of the file, and never lines. If one of those versions does not parse — which is
how hand-editing an outline goes wrong — the panel says so and still draws no
diff, and the file's own page shows you the validator's rows where they belong.

## Attachments

You can paste a file into the box — a screenshot, a photo of a whiteboard — or
drag one onto the panel, or pick one with the **+** button, which is the way in
on a phone. All three take the same kinds:

- **pictures**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`,
  `.ico`
- **documents**: `.pdf`, `.txt`, `.md`, `.csv`, `.json`

The bytes go into a temporary directory belonging to that conversation, never
under the directory being served, and the agent is handed the PATH: it reads
the file itself, so nothing rides the prompt into the stored session, and
nothing attached here can end up committed with your outlines. The files go
away when you start a new conversation or stop the server.

A picture shows itself in the strip above the box. Anything else shows its name
and how big it is, because a PDF has no thumbnail worth drawing and a broken
image icon is a lie about a file that arrived perfectly.

Dropping is aimed at the whole panel rather than at the box: while you are
dragging over it the panel says so, and what lights up is what will take the
file. Several files in one drop attach in the order you dropped them, and they
reach the agent in that order. Anything olai will not take is named where it
was dropped — an SVG (a document that can script, whatever the drag calls it),
a `.zip`, a file over the 50 MB cap — so a drop never disappears quietly, and
whatever it can take in the same drop still attaches.

## kolu

If the machine is running [kolu](https://kolu.dev) — terminals for coding
agents — the panel's agent gets kolu's terminals too, and there is nothing to
set up: every new conversation looks for the padi daemon this host answers
on, and hands the session `kolu mcp` when one is there. It is looked for
rather than assumed: olai starts the `kolu` it found and asks it to read
something only a running daemon can answer, because a `kolu` on a PATH is not
always the one this host is running, and a wrong build will start perfectly
well and know nothing.

## When a tool server does not arrive

**A server that fails to attach is on screen, not in a log.** If there is a
`kolu` on this host's PATH and it would not answer, the panel says so under the
header — the name, and the reason the probe or the server itself gave:

```
● kolu is missing from this conversation
  it refused to read the daemon's identity: surface-mcp: padi transport down
  /nix/store/…/bin/kolu
```

The reason is the point. Every way of failing looks the same from the outside —
the agent simply has fewer tools — and they want different things done about
them: a padi that is not running is one thing, a `kolu` that is an older build
missing half its verbs is another, a file on PATH that will not run at all is a
third, and one that reads and never answers is a fourth. (There is a fifth
sentence, `talking to it failed: …`, and seeing it means something unusual: the
reason a broken pipe reached you before the reason the file would not run.) The
path is there for the same reason: a padi-spawned terminal prepends its own
bundled copy of kolu, so *which* one answered is the question this usually turns
out to be — and the one failure with no path to name says so instead.

**`PADI_SOCKET` counts as somebody saying kolu should be here.** If the variable
is set — a kolu terminal sets it for what it starts, and a person who set it by
hand meant it — and there is no `kolu` on the PATH this server was started with,
that is a miss and the panel says so. It is worth knowing because *olai's* PATH
is not your shell's: run as a systemd user service (the home-manager unit), it
inherits neither, so a kolu you can run in a terminal is not necessarily one
this process can see. That was the original mystery from the other side.

It is per conversation, because the detection is: start a padi and the next
conversation has the terminals, with nothing to restart and nothing left on
screen saying otherwise.

**A machine that is simply not running kolu sees none of this**, and that is
deliberate — nothing failed. What the panel reports is a tool server that was
here and would not work, or one something said would be; never the absence of
one that was never installed.

What olai cannot report is a server it handed over that the *agent* then failed
to connect to: ACP answers `session/new` with a session id and says nothing per
server, so that is not a fact this end is ever told. The failures shown are the
ones olai found itself.
