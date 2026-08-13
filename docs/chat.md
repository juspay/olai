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
missing half its verbs is another, and a file on PATH that will not run at all
is a third. The path is there for the same reason: a padi-spawned terminal
prepends its own bundled copy of kolu, so *which* one answered is the question
this usually turns out to be.

It is per conversation, because the detection is: start a padi and the next
conversation has the terminals, with nothing to restart and nothing left on
screen saying otherwise.

**A machine that is simply not running kolu sees none of this**, and that is
deliberate — nothing failed. What the panel reports is a tool server that was
here and would not work, never the absence of one that was never installed.

What olai cannot report is a server it handed over that the *agent* then failed
to connect to: ACP answers `session/new` with a session id and says nothing per
server, so that is not a fact this end is ever told. The failures shown are the
ones olai found itself.
