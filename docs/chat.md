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

The agent cannot free-write a file. It has no filesystem access at all: the
only things it can name are nodes, through a closed list of tools — search,
read a subtree, create an outline, add, mark, retitle, note, schedule, move,
archive, place a mirror, retire one, and wire what a node waits on. So the
edits it can express are the edits the format can be, and a malformed outline
is not something it can produce. When a write is refused, the validator's own
rows come back, pinned to the lines they are about; when a write lands but is
worth a second look, the answer says so — advice about something that
happened, never a refusal.

It can ask you back: when it needs to know which of two things you meant, the
question arrives as a form in the conversation, and nothing times out.
Dismissing one is an answer too — the agent is told you would not say, never
handed a choice you did not make.

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
