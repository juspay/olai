# The chat agent

Start an agent on an outline row, unfold its conversation, and tell it what you want. Ask it to check something off and the checkbox moves: its write goes to disk through the ordinary validator and returns on the same subscription as every other edit.

What you type sits on the right, in a tinted bubble. What the agent answers sits on the left, as prose. The two used to share one shape — a faint box on the human's words — and a glance could not tell them apart.

## Who is talking

**Engine switches work without restarting the server.** Enabling an installed engine makes it available to start controls. Disabling it releases its live sessions; restoring it lets retained readers reopen, while asleep agents remain asleep. The lifecycle scenarios send messages after recovery, including after chat itself is remounted.

**Every stretch of messages is named, with a face and a name over it.** There are three parties in a conversation — you, the agent, and any plugin allowed to ring this conversation — and shape alone stopped being enough to tell them apart the moment there was a third. So each *run* of one party's messages opens with a small line saying whose it is.

**It is once per run, not once per message.** An answer that is a paragraph, four tool calls and another paragraph is one turn by one party, and it is named once. Your next message starts a new run and is named again.

**Your face is your own picture**, resolved the same way the picture in the top-right corner is: whatever your proxy sent, else the operator's avatar template, else the gravatar of a real email claim — and the plain silhouette when none of those had one, which is a face like any other and not a failure. On a serve with no login in front of it the line simply says *you*.

**The agent's face is its mark** — the same one the agent line and engine choices draw, so the agent above the transcript and the agent in the transcript are visibly one thing. An agent olai has no mark for gets a plain generic one and its full name beside it; it never borrows another agent's.

**A plugin's face comes from the plugin.** Olai does not draw it and does not keep a table of them — the mark ships with the plugin, so the day a new one delivers a sentence into a conversation it arrives wearing its own face and olai is not changed at all. A plugin that ships none gets a plain generic one and its name in full.

## Which agent

Chat speaks [ACP](https://agentclientprotocol.com), and it talks to whichever agents this machine has. It finds them itself: pinned **Claude Code** and **Codex** adapters, which come with olai — `nix run`, the packaged binary and `just serve` all bake them in, so there is nothing to install or put on PATH — an **opencode** on the server's own PATH, and **pi**, whose adapter is pinned and shipped but whose agent is found the way opencode is: a `pi` on the server's agent search path is the machine saying it has one, and without it there is no pi row.

Each engine is a plugin: [claude](plugins/claude.md), [codex](plugins/codex.md),
[opencode](plugins/opencode.md), and [pi](plugins/pi.md). Setting `on: no` on its
node in `_olai/Settings.olai`, or using the plugins panel switch, removes its
probe and choices without disabling the other engines. Choices follow the
server's current engine roster.

A conversation belongs to one engine for its lifetime. Row and new-chat start
controls ask which engine when several are available and start immediately
when there is only one. A plain node page shows its selected engine beside the
composer. The choice belongs to that conversation; a fresh start uses the
node's existing engine. The agent line names the engine and confirmed model.

The list itself:

- **found once, when the server starts.** An agent installed while olai is running is offered by the next start. Enabling or disabling an already-discovered engine plugin updates its availability while the serve runs.
- `OLAI_ACP_AGENT` points at a different ACP agent for the Claude row — that override has always meant *read this the way you read Claude Code*, and it still does. `OLAI_ACP_CODEX` and `OLAI_ACP_PI` are the Codex and pi halves of the same arrangement: which adapter chat spawns is a pin olai bakes in or a person overrides, never whatever `npx` would have fetched today. Empty `OLAI_ACP_CODEX` omits that row; empty `OLAI_ACP_AGENT` makes only its engine unavailable.
- To turn chat off, set `on: no` on the chat node. An empty adapter path does not disable the conversation or suppress other engine probes.
- `OLAI_AGENT_PATH` is where the probes look, and defaults to `PATH`. It is worth knowing about because **olai's PATH is not your shell's**: run as a systemd user service (the home-manager unit) it inherits neither your profile nor your login shell, so an `opencode` you can run in a terminal is not necessarily one this process can see. Set it and it REPLACES the search path. For pi it answers a second question too: the `pi` the probe finds there is handed to the pinned adapter as the one it wraps, so the pi the row runs is the pi the probe found rather than one the adapter resolved against its own environment.

With no agent available the plain node page still draws its explanation, and says which agents olai can talk to and where to get one — because a feature that is silently absent cannot be told apart from one that is broken. That list is the ENABLED ENGINES and each one's own sentence about how it is got, answered by the server: a serve started `on: no` on the unwanted engine nodes in `_olai/Settings.olai` says how to install opencode and does not offer a Claude Code it could not mount.

**The explanation distinguishes two reasons for having no agent.** No engine rows enabled and no executable found need different remedies. The server knows which occurred and supplies the opening sentence:

| what it says | what happened | what to do |
| --- | --- | --- |
| *This serve has no agent engine* | no engine row is running — the file enables none, one was switched off at the plugins panel, or an engine's plugin failed to start | switch one on in the plugins panel, or edit the file / name an engine in it — every engine is on by default |
| *No agent is installed for this panel* | every engine was asked and this machine has none of them | install one of the agents listed, or set `OLAI_AGENT_PATH` where olai should look |

The same sentence goes in the log, off the same value, so what you read on the screen and what you grep out of the journal are one account of one boot.

The conversation is the agent's own session for that directory. Opening a node agent reads its session property; restarting the server opens no conversation automatically ([below](#which-conversation-you-come-back-to)). A session id means nothing to the other agent, so this is not a nicety: asking the wrong one to open it gets a refusal. And (for the Claude agent) `claude --resume` in a terminal reaches the same conversations.

### What differs between them

Anything an agent does not offer simply is not drawn — except where you would expect the behaviour, and then the absence is stated rather than left to be discovered. Each engine's own page has the whole of its wire; what follows is the comparison, which is the thing no single page can make:

- **Claude Code and Codex can be INTERRUPTED.** Both advertise `_session/steering`, so the control is offered from a positive handshake fact rather than from the engine's name. Opencode has no such method, and neither does pi; those rows simply draw no interrupt gesture ([below](#talking-while-it-works)). Pi instead queues a mid-turn message and announces its position. Codex advertises steering without ordinary prompt queueing, so normal busy sends use steering too.
- **opencode and pi subagent activity is drawn flat** — every call in one column — rather than in lanes ([below](#when-the-agent-sends-other-agents)).
- **Codex uses native child sessions.** Each announced child gets an agent card; its tools and nested agents belong behind that card's work door, its prose stays in its fold, nested work opens in the same panel with a back button to the parent, and its questions stay visible and attributed in the main conversation. Codex background terminals use the existing task rows and running strip, including active terminals announced on session load. Their lifecycle is independent of the main turn. Individual task stopping is not exposed by the panel. See [Codex](plugins/codex.md) for the negotiated adapter extensions.
- **a tool call's name comes from wherever that agent says it.** Claude Code says it in a field of its own; opencode and pi say it at the head of the call id (`bash:0`, `edit:1`). Codex's title is display text while its id is opaque, so this plugin names no tool for the approval boundary. In every case a tool olai cannot positively name is one you are asked about rather than one quietly allowed.
- **pi works the same olai tools the other agents work — through the pin's own bridge, because pi's adapter never came with one.** Its harness has no MCP client of its own (its own README: *No MCP*), and the ACP adapter wraps the harness's remote-control drive rather than the harness's config — so the session's MCP servers the panel hands it would have gone nowhere at all without something loading them INTO the agent. That something is the pin's job: the pinned adapter (its patch is `packages/plugins/pi/acp/patches/README.md`, its shape is two dozen lines) spawns each conversation's pi with the bridge extension loaded and the servers passed along in its environment, and pi's own extension API registers them as ordinary tools — the `olai_*` / `kolu_*` names the other agents use are the names its rows answer by, with the call AND its result in the transcript the way any tool's is. The limits left are honest small ones rather than a lost feature: **a tool's spelling of *ours* is pi's own, so no permission question ever comes back over ACP to here** — pi's own settings govern what it may do, the way the other agents govern theirs; the banner's rows stand **handed** and there is no per-server tick to move them, because attaches are per conversation, not per server; and a conversation run on an adapter olai did not build (the override lane in the pin's scripts) answers for the wiring it actually carries — none of this is the adapter protocol's own vocabulary. What you lose on pi, said elsewhere here rather than repeated: the stored list shows at most pi's **newest fifty** conversations — the adapter answers in pages of that size, newest first — and its bash output streams underneath the tool row (file edits draw as diffs, fully).
- **pi's own hello is not conversation.** Open a conversation with pi and its adapter publishes a startup banner for editors — pi's version, maybe an update nag, a list of the context and skills it loaded — and then repeats it into the session as an ordinary message, for clients that draw no banner block. The transcript leaves the repeat out, matched on the exact text the open's own answer carried, never on a guess at prose. Stated here rather than left to be discovered, because the difference between pi saying nothing and pi having said nothing is something a transcript owes you: a first turn whose only content would have been that banner is a silent turn, and the panel names silent turns — a banner standing where the silence notice belongs would be the one chunk that made it look answered.

## Session controls and progress

Press the model name in the agent line to see the agent's advertised settings. Alongside models, adapters may offer reasoning effort, operating mode, or a boolean option such as fast mode. Controls use the adapter's names and allowed values; changing a model can change the other options. Settings are available while the conversation is idle. Refused changes leave the confirmed value visible. Model choices persist per conversation; the adapter owns persistence of other settings. On every new or resumed session Olai reapplies the engine's declared permission mode; [Codex selects full access](plugins/codex.md), and requires successful selection before the conversation becomes active. Claude prefers its bypass mode but reports a refusal and continues with its existing permission backstop. A required-mode refusal clears provisional model/settings and replayed transcript state; retrying must open successfully before prompts can run.

An agent that sends an execution plan gets a compact plan below the agent line, with pending, active, and completed steps. Each update replaces the whole plan. An empty update removes it, and starting another conversation clears the old plan.

Terminal-backed tool calls show stdout and stderr as they arrive, followed by the exit code or signal. Output remains readable after the agent releases its terminal handle. Olai supports ACP's create, output, wait, kill, and release requests, and reads the terminal-output metadata supplied by Codex and pi. Client-owned commands run in the served directory unless the agent supplies an absolute working directory; cancellation and session cleanup stop them and their process groups. Output keeps the newest complete UTF-8 characters, with a truncation notice: 64 KiB by default, an agent-requested limit capped at 1 MiB, including a valid zero-byte limit. Adapter-owned commands remain the adapter's responsibility to stop.

Screenshots: [session settings](images/acp/acp-session-settings.png), [execution plan](images/acp/acp-execution-plan.png), [terminal output](images/acp/acp-terminal-output.png).

## Which conversation you come back to

Server boot opens no conversation. Reload folds every outline conversation;
Recent and the palette lead back to its node. A zoomed node page reads the
conversation named by its property. Ongoing work and derived wakes can keep a
session live independently of browser readers.

The old which-conversation note is neither read nor written. Old notes remain
subject to generic state pruning, without migration or special preservation.
Confirmed model choices have a separate store keyed by engine and session,
read only when that conversation opens, capped at thirty-two recently touched
choices. The upgrade can cost one model switch. The separate `heard/` records
and wake preferences remain.

Unclaimed stored conversation heads are [filed into the Inbox](#filing-stored-conversations-into-the-inbox).
The conversation line offers a node agent's past sessions, with the counts and
dates its engine supplies. An unreachable engine is named with its reason;
absence of an answer is not presented as an empty history.

Answers stream incrementally, with browser updates batched several times per
second. A conversation opens at its newest line. New text follows only while
you are at the bottom; scrolling up keeps your place. A fold bounds its
transcript, while a zoomed page scrolls the containing pane with the conversation.

Unsent words, attachments and nodes chosen through `@` belong to their
conversation in this tab. Closing a fold, visiting history, or rebuilding an
unrelated plugin retains them. Sending clears that draft; a refused send can
restore it for send again in its own conversation. Reloading or closing the tab
discards in-memory drafts.

## Who, and which model, the agent line names

Under the conversation's title, the agent line names **the agent** — its mark and its name — and then the model. The agent is there because a conversation is bound to one for its life and "who am I talking to" is a question you answer by looking rather than by reading; the model is there because a turn's cost and character depend on it and nothing else on screen says.

An agent olai has no mark for gets a plain one, and its name in full beside it. It never borrows another agent's mark.

**Press the model name to choose another model.** The menu uses the options supplied by the current agent and is available while the conversation is idle. Olai sends the selection through ACP configuration, so this works with Codex even though its adapter has no `/model` command. The agent line changes when the agent confirms the choice; a refusal leaves the current model in place and shows the reason. The choice is remembered for the restored conversation. Agents that supply no model options keep a plain model label.

Claude also supports its own `/model` command. For that command, the agent line names the model the agent is **running**, which is not always the one the session was started on: `/model` is handled inside the CLI the adapter wraps, so the adapter never learns of it and its own picker goes on reporting the starting model for the life of the session. What the agent line follows instead is the CLI's own message, forwarded because olai asks for it whenever it opens a conversation — a new one and a stored one alike.

Two consequences, both of them the adapter's shape rather than a choice:

- **it changes one turn late.** That message is emitted as a turn STARTS, so the turn that ran `/model` still announces the model it began on, and the new one is first heard of when you send the next thing. Nothing else on the wire carries it — the only other trace of the change in that turn is the agent saying so in prose, and reading a sentence is not something olai will do.
- **it is named the way the agent names it.** The running model arrives as an API id (`claude-sonnet-5`) while the picker offers aliases (`sonnet`), so the two are matched up and the agent line says *Sonnet*. A model the picker does not offer at all is shown as the id it came as, which is truthful about a name nobody gave — never rounded to whichever row looks closest.

**A raw id in that line is a refusal, not a failure**, and the commonest reason for one is worth knowing: the running model never states its **context window**. The CLI reports `claude-opus-5` whether the session has 200k or 1M, so when the only Opus the picker offers is the 1M one, that row is not allowed to answer — naming a window five times the real one, in the line you would read to decide whether to `/compact`, is worse than naming nothing. You get `claude-opus-5`, and what it does not say, it does not say.

## The model you switched to survives a restart

**Choose a model in the agent line, or switch Claude with `/model`, and it stays switched**, across an olai restart and a new deploy — the conversation comes back on the model you put it on, and the agent line names it before you type anything.

That is a fix rather than a given, and what it is a fix for is worth knowing about because it happens at the agent's end, not olai's. The agent resolves a session's model in a fixed order — the `ANTHROPIC_MODEL` variable, then `settings.json`, then the model the conversation was actually running — and on *resuming* a conversation it deliberately re-asserts the first two over the third. So a machine whose settings pin `"model": "sonnet"` puts every restored conversation back on Sonnet, however it ended. A `/model` lives only in the conversation itself, which is the half that loses. The chat was on Fable on Friday and on Sonnet on Monday, and nothing said why.

So olai records confirmed model switches in the conversation’s own keyed model record, and after a restore, if the conversation has come up on a different one, it says so back — through the same model setting the agent's own picker is. What you get is the model you chose; what a *new* conversation gets is still the machine's default, which is what a default is for.

**And a `/model` made in a conversation you came back to is heard at all**, which is the quieter half of the same fix: the CLI's message is forwarded because olai asks for it when it opens a session, and it was only asking when it *started* one. Every conversation after a restart is a restored one, so the agent line had gone deaf in exactly the conversations you spend your time in — it went on naming the model the session came up on, however many times you switched.

Two things follow, and both are the honest shape of it:

- **only a switch you made while olai was watching is remembered.** A conversation that never left the machine's default comes back on the machine's default — olai has nothing of its own to say about it, and pinning a conversation to whatever the default resolved to that day would be inventing a choice nobody made. One consequence is worth knowing after an upgrade: a `/model` from before this existed is not a switch olai saw, so the first restart still opens on the default and switching again is what makes it stick. The upgrade to per-conversation model records has the same cost: the old note is not migrated, so switch the model once more in the conversation it remembered.
- **a switch made somewhere else, while olai was not running, loses.** The conversation is reachable from a terminal (`claude --resume`), and a `/model` typed there lands in the same place a static pin does, as far as anything on the wire can tell: the restored conversation simply comes up on a model olai's model record disagrees with. Olai reapplies its recorded model choice. Between a panel that loses the choice made *in* it every single restart and one that can lose a choice made elsewhere while it was off, this is the better of the two.

If the model cannot be put back — an agent that will not take the setting — the conversation opens anyway, on whatever the agent chose, and the panel says so in a row rather than in a log. Nothing is retried behind your back; the next restart tries again.

## How full the context is

Beside the model, the agent line says how much room is left: **`22k/1M`** — tokens in the conversation, and how many fit. It is the other half of the model's own sentence, and it answers the question the panel used to have no answer to at all: *is it time to `/compact`?* Before this, the way you found out was by watching the agent start forgetting.

It comes from the agent, not from a count kept here — ACP carries it (`usage_update`), and olai draws what it is told. Several arrive per turn and the newest wins, so the number moves as a turn runs rather than only at the end.

A **fraction rather than a percentage**, because the window is not a constant: 200k and 1M are both ordinary, and a session moves between them when the model does. "2%" would read identically in both and mean quite different amounts of work left, so both numbers are shown and the division is yours.

Two things follow from it being the agent's number:

- **the window itself can move under a conversation.** The agent seeds it from what it last knew for the model and corrects it when a turn ends, so the first turn after a `/model` can report the old window and then the true one. That is the agent revising something it told us, and the agent line follows it.
- **an agent that reports nothing gets no line.** The agent line simply says nothing about room, which is different from a conversation that has spent nothing — that one says `0/200k`. You will see this twice: before the first turn of a fresh conversation, and after **opening a stored one**, which replays its messages without a usage report. In both cases the next turn fills it in.

What a session has **cost** is on the wire too, and is deliberately not drawn: it is a different question, asked at a different moment, and a second number there would buy nothing for the one this line exists to answer.

## Talking while it works

**The box never locks. With Codex, messages sent while it works steer the running turn.** Olai uses the adapter’s steering feature rather than opening another prompt. The turn’s completion clears the working indicator. If the turn finishes just before steering arrives, Olai starts a normal prompt for the message and tracks its completion and cancellation.

**Agents that support a prompt queue receive ordinary messages immediately and handle them in order.** Claude, opencode and pi keep this behavior: queued messages wait at the agent and are marked *queued* until picked up. For Claude, this also lets `/compact` finish without a normal send interrupting it.

**Interrupting is its own gesture: Alt+Enter, or the `interrupt` button beside send.** That one really does go *into* the turn in flight, so an agent halfway through the wrong thing can be redirected while it is still doing it — "not that file, the other one" is worth saying at the moment you notice, and that moment is almost never the moment the agent stops. It costs what it sounds like it costs: whatever the turn was in the middle of is torn down to make room. That is the trade, and it is yours to make on purpose.

**Once you have sent a message that had to wait, this conversation stops offering it.** The button goes and Alt+Enter becomes an ordinary send. That is a guard around a bug in the agent adapter olai pins, not a decision about what is useful: interrupting a turn in a conversation that has ever queued leaves that turn never finishing — the words you interrupted with arrive and are answered, but the panel stays on *working…* until you press **cancel**, which does end it and loses nothing. Rather than hand you a button that does that, the panel takes it away for the rest of the conversation. **A new conversation gets it back** (`+ new`, or opening a stored one), because the problem is per conversation. It goes away for good when the pinned adapter is fixed, which a pin bump on its own does not do: the last one moved the adapter four releases and the bug came with it.

**One way in is not guarded, and it is worth knowing which.** Once the agent has armed a **watch** — the thing whose clock rides the strip under the header — interrupting hangs the same way, and because nothing queued there the button is still offered. A shell sent to the background does not do it; a watch does. The recovery is the same one: your words arrive and are answered, and **cancel** ends the turn and loses nothing.

**Not every agent can be interrupted, and the panel simply does not offer it where it cannot.** The agent olai ships with says at startup that it takes one; opencode has no such method, so there is no button and no chord — and nothing else differs. Sending is sending on both. An agent that will not take a second message at all while it is working (an older adapter) refuses it, and you get the refusal on the row with *send again* under it, like any other message that did not land.

**While anything is happening, a line under the transcript says so** — *opencode is working…*, *starting opencode…*, or *waiting on your answer* when the turn has stopped on a form. It sits between the last row and the box, which is where you are looking after you press enter, and it is gone the instant the panel is idle. The header says the same fact up in the chrome; this is the copy you can see without moving your eyes. (The box's own border turning is focus styling — it is the border a click into the box draws — and it never meant anything else.)

The button says **send** the whole time, because that is what it does the whole time. Cancel sits beside it rather than replacing it: sending and stopping are two things you can want at the same moment, and while a turn runs they are usually the two you are choosing between. `interrupt` appears between them while a turn is running, on an agent that takes one.

**Sending belongs to the conversation shown when you press it.** A delayed tab cannot send, interrupt or retry a message in a different node selected by another tab. Retry controls carry the conversation identity as well as the message ID, since each transcript numbers its messages independently. Refused text, chosen `@` handles and uploaded files return to their original conversation, including after a drawer remount; text typed while the refusal was in flight is retained after the recovered message. Refusals also remain visible when a response arrives after the drawer was reopened. The palette’s `>` command checks the same conversation identity and keeps a refused command in its input.

**Cancel belongs to the conversation shown when you press it.** Another tab opening a different node does not redirect the control: it still cancels this conversation. If this conversation’s process lifetime has changed, the stale control refuses with “the conversation changed”.

**Try again on a refused session belongs to that conversation too.** Each node keeps its own attempt available, and opening another conversation in this or another tab cannot redirect a retry to it.

**Cancel stops the agent, and only that.** There is nothing else for it to do — every message you have typed already went. Anything waiting behind the turn you stopped is at the agent, not here, so it survives and runs next: cancel is about the turn in flight and nothing else. This is a change worth knowing about if you used olai in early 2026: a message sent mid-turn used to be held *by olai* until the turn ended, and cancelling threw away everything that was waiting. Those words were nowhere else. Nothing is held here now, so there is nothing to throw away.

**A message waiting its turn says *queued* under it**, and stops when the agent picks it up. Nothing has gone wrong with it — it is at the agent, next in line — so the bubble is drawn exactly as any other message of yours, and what you get is an answer to "is anything happening about this". The mark comes off by itself when the turns in front of it end.

**If a message cannot be delivered, it stays on screen.** That is a different thing, marked differently. It keeps its own bubble, exactly as you typed it, outlined and marked — and the mark says which of two things happened, because they are not the same thing and they do not deserve the same button.

***not sent*, with send again underneath.** The agent said no: it would not take the **interruption** you asked for, it was not there to be asked, it **refused the turn itself**, or **you cancelled while your message was still on its way** — a fair thing to do, and the cancel wins rather than your message quietly starting the turn back up. Nothing took the message in any of those, so pressing the button sends it for the first time — as an ordinary message, never as a second interruption, so if a turn is still running it goes and waits its turn there. Nothing retries on its own; whether to try again is yours.

A queued message refused while an earlier turn is still running keeps this marker and its attachments even if that earlier turn continues streaming. Output from the earlier turn does not count as delivery of the refused message.

**And a conversation the agent will not open is not a dead agent either.** Starting one, or re-opening a stored one, is a request like any other too — so an agent can say no to it: a directory it will not work in, a conversation it no longer has, a mode it cannot resume from. The panel then says *that*, in the agent's own words, where the conversation would be: the header goes on naming the model, because the agent answered and is therefore running; there is no box, because there is nothing to send to; and there is a **try again**, which asks for the same thing that was refused rather than for whatever olai would have picked. Before this the panel said *not running* about a live agent and left an empty transcript with a working box under it. Press *try again* twice and the second press is told there is nothing waiting — the first took it — because two retries of a refused *new conversation* would be a second fresh one wiping the first. That explanation goes away with the agent: a refusal is about one that is running, so a process that dies takes it with it and you are back to the rows it left.

**A message typed while a conversation is opening waits for it.** Opening one takes real time — a freshly picked agent is a subprocess starting, a handshake, and then a whole conversation replayed before it answers — and the box is not locked while it does, so the next thing you type lands in the gap. It goes into the conversation being opened, once it is: nothing is refused, nothing is lost, and nothing is sent twice. Before this it started a second open of its own, against the first, and the message died with it; and a message sent in the seconds after picking an agent lost its own bubble, because the replay of the conversation it was going into empties the transcript it had just been written to. What you see instead is the panel saying it is **starting** — from the moment you click, not from whenever the server's first frame arrives — and your message appearing when there is a conversation for it to appear in.

**A turn the agent refused is a turn that ended, not an agent that has gone.** Starting a turn is a request like any other, and an agent can answer one with an error rather than with a result — it is in a mode it cannot work from, it has lost track of the conversation, it could not reach the model. What you get is the reason, in the conversation, and a panel that is still *ready*: the agent is running, you are still in the conversation you were in, and the next thing you send goes to it. Olai used to read that as the agent having died, and then said *not running* about a process that was running until some later turn happened to succeed.

***no answer — it may not have arrived*, with no button at all.** Your message went out and nothing came back — the agent went quiet, or died with the message on the wire. An agent that took it and *then* went silent looks exactly like one that never took it, so olai will not tell you which, and will not offer you a *send again* that might be a second copy. The words stay in the bubble where you typed them; what to do next is yours, and a look at what the agent did afterwards is usually the answer. The reason also goes into the conversation as a line of its own, so it is still there after the banner has cleared.

**A turn that ends having said nothing is not a turn that went well.** The agent takes the message, answers that the turn is over, and produces no prose, no tool call and no question — so the panel used to draw exactly that: nothing, under the message you just sent, and back to *ready*. It is what an agent that cannot reach a model looks like from here, and it is quiet on purpose at the other end — opencode with a provider key it cannot resolve sends one zero-token usage report and then a **successful** end-of-turn, with no error anywhere on the wire. Olai now says it: a notice in the conversation naming the agent that was silent and telling you to check that it is signed in and that its provider key is in the environment olai itself runs in, and the banner stays up rather than clearing on the way to idle. The commonest cause on a deployed instance is the environment — an agent olai spawns inherits *olai's* environment, not your shell's ([running.md](running.md)).

A turn you **cancelled** before it said anything is not this: it already has a notice of its own, and blaming the agent for stopping when told to would be the panel arguing with you.

## What it can touch

Errors from web actions stay where you made the action. For example, if moving a node to Trash fails, the node menu shows the reason without adding a refusal to ACP chat. Refused agent tool writes still show their structured detail in the transcript.

**Olai hands the agent no filesystem.** What olai itself gives it is a closed list of tools that name a NODE, a whole DOCUMENT or the whole TRASH, and nothing smaller than any of them — search, read a subtree, create an outline, add, mark, retitle, note, schedule, move, trash, place a mirror, retire one, wire what a node waits on, and empty the trash, plus the two that do several of those as ONE write (`outlines_update` for several fields of one node, `outlines_apply` for a list of ops over many) — so the edits it can ask *olai* for are the edits the format can be, and a malformed outline is not something that path can produce. The documents beside the outlines have four verbs of their own — `markdown_index` and `markdown_read` to find one and read it whole, `markdown_create` and `markdown_write` to mint one and replace its text — and they are still not file access: the listing is this directory's own set rather than a disk, and neither end of a document call names an offset or a range, because a `.md` is one text. The one verb on that list that DELETES is `trash_empty`, which names `_olai/Trash.olai` and empties it whole — every record in the trash or none, nothing put back by anything in olai, and refused while a live row still points into it. When a write is refused, the validator's own rows come back, pinned to the lines they are about; when a write lands but is worth a second look, the answer says so — advice about something that happened, never a refusal.

**What the agent brings with it is its own.** The default agent is a coding assistant, and a coding assistant edits files: ask it to fix a typo in a `.md` and it will, with its own tools, on its own authority — the same authority it has in a terminal, over the directory it was started in. Olai neither grants that nor pretends it away; what it does is SHOW it, which is the section below. The one thing worth knowing is that an agent editing a `.olai` by hand is writing the format without the validator in front of it — the outlines are plain text and nothing stops that — so if you want an outline changed, ask for the change rather than for the edit, and it goes through the tools.

It can ask you back: when it needs to know which of two things you meant, the question arrives as a form in the conversation, and nothing times out. Dismissing one is an answer too — the agent is told you would not say, never handed a choice you did not make.

## Asking about one node

**Ask agent** on a row targets its nearest ancestor agent, including the row
itself, unfolds that conversation, and arms the selected node for the composer.
The palette's `>` sends to the focused row's same nearest ancestor after
unfolding it. This lookup uses the outlines reading and works with search off.
No focused row or no ancestor refuses with **no agent above this row — start one**.
An unbound ancestor refuses with **this agent has no session — start one**.
Both refusals preserve the palette text and start nothing.

An armed node travels as its id. At send time the server resolves its current
title, file/line and ancestor titles from the same reading a write uses; it does
not paste a stale copy of the subtree into the prompt. The agent can read the
live vault with its tools. Renaming between arming and sending therefore uses
the new title, while deleting the node refuses the send rather than sending a
question with its subject missing. The chip can be removed before sending.

## Naming a file, or a node

**Type `@` and the directory comes up**, filtered as you type — its **files** first and its **nodes** under them, in one list of eight, four rows kept for each kind and either taking the other's unused ones. (That reserve is why a file you were expecting can be missing: nine matching filenames cannot push every node off the list, and a vault full of matching rows cannot bury the file you type every day.) Taking a file writes the whole path into your sentence (`read @notes/cabinets.md `); taking a node writes its id (`look at @hinges `) and puts the node on the message, as a chip above the box. It is the gesture a terminal agent already has, and it is here for the same reason — a vault spells its folders however it spells them, and a path half-remembered reaches the agent as a file that is not there. A row half-remembered was worse: there was no way to name one at all.

What the file half offers is **the files this directory serves** — every outline, every document, every saved page, which is the set the sidebar draws — because they are already on this tab's subscription. Nothing is walked to answer that half and nothing is asked of the server, so a vault with a thousand files costs the same as one with ten. The NODE half is the other way round now: it is the server's own search ([search.md](search.md)), so it arrives a beat after the files rather than with them — which is why each half keeps four rows whatever the other found, and why a list you are already walking does not reshuffle when the nodes land. The archives are in it, unlike in the sidebar, which hides them behind Trash: what a message may NAME is a file the agent will open, an archive is a file, and "what did we put away last month" is a fair thing to ask.

A file row reads the file's **name**, with its folder beside it, and writes the **path**: a `Daily/` vault is a column of identical dates otherwise. `@notes/` works too — a folder is the start of a path like any other prefix.

**The node half is the search you already know** — literally the same one, asked of the server, so `@cab` here selects what `cab` selects in the filter bar, in the `⌘K` palette and in an agent's `search_nodes` — title, id, tag and note, ranked the same way, with a finished node losing ties ([search.md](search.md)). Whatever fits in one word works: `@is:blocked` names something that is waiting, `@#home` names by tag, `@date:today` names something scheduled. What needs a space does not — a quoted phrase, an `OR` — because the word ends where you would expect a word to end, and a completion that swallowed the rest of your sentence on the chance the next word was for it would be worse than one you have to finish elsewhere. `@` **names** one node; the palette **searches**.

That has one honest consequence: an operator with no word in it scores every match the same, so all that orders `@is:blocked` is the rule that puts finished work last, and then the directory's own order — not the eight most relevant. There is nothing to be relevant to.

And one more, from the day the node half became a question: **fewer than three characters offers no nodes** — the floor every box onto this search keeps, because two characters match half an outline by substring. `@ca` offers the files; `@cab` offers both.

**What was put away is not offered, and `@is:trashed` is how you ask** — the ruling that what is archived is drawn on the Trash and nowhere else, arriving here without being restated ([search.md](search.md)'s one-page rule). It is the opposite of the file half of the very same list, deliberately: a path names bytes an agent will read, where a node names a row of a reading. The third list over this set, the `#tag` completion in a row's editor, goes the archived-out way for its own reason — it ranks the vocabulary of the page you are looking at.

A node row reads its **title**, and beside it the **id it writes** and where it sits — the file first, then ancestors from the file down on a second line that keeps the file and nearest ancestor visible, with the `·` belonging to that trail and to nothing else. Two rows with one title are what that is for; a vault gets a pair by copy-paste, and picking blind between them is the thing this feature exists to stop. A row that is there for something in the node's **note** says so, because otherwise it is a row whose every word is unfamiliar.

**Why the id, and not the title.** The sentence has to name something that stays true. A title is prose — not unique, edited by anybody, with no end inside a sentence — so a message carrying one would be a copy going stale between typing it and reading it back next month. The id is the handle every one of olai's tools takes, and it does not change. You never have to read it: the chip above the box says the node's title, live, and the message you send carries the same chip.

**And the chip is not decoration.** Taking a node arms it, exactly as **Ask agent** on a row does — so the agent gets one line under your message naming the node's id, title, `file:line` and the titles it hangs under, resolved by the server against the set as it is at the moment you send. The word says *where in the sentence* you meant it (`compare @a with @b` is unsayable by two chips); the line says *what it is*. Neither is a copy of the other.

**The words are the last word.** What a message is about is the nodes you took off the list that the message still names — so deleting `@hinges` takes the chip away too, and typing the word back brings it back. The `×` on a chip works the same way from the other end: it takes the word out of the sentence. There is nothing to remember and nothing to keep in step. (An **Ask agent** chip is not read back that way — that gesture put a node there *instead* of a sentence, so there are no words for it to be contradicted by.)

**⌘Z does not take a completion back**, and this used to say it did. Taking a row writes into the box the way a program writes rather than the way a finger does, which is what empties the browser's own undo history for that box — so the keystroke that would undo it has nothing to undo. Delete the word instead, and the chip goes with it. (Undo still works on what you typed *before* a completion, in the ordinary way; it is the completion itself that is not on the stack.)

**What it writes is a word, not an attachment.** The `+` button copies a file into a temporary directory and hands the agent the copy's path (see below), which is right for a screenshot on the clipboard and wrong for a file that is already in the directory the agent is working in: the copy stops being true the moment anything writes it. So a completed path goes in as text, the message reads the way you typed it, and the agent opens the file where it lives.

**It never fights an `@` you meant as a person.** `@` is a tag sigil in olai's own format — `@alice` in a row's title is a tag, and the title editor completes those — but none of that vocabulary exists in this box: a message is prose on its way to an agent. Four things follow, and they are what keep the two apart:

- an `@` **inside a word** opens nothing, so `srid@example.com` is an address;
- an `@` whose word matches **no file and no node** draws nothing at all, so `@alice` types straight through and Enter sends;
- if one *does* match something you did not mean, **Escape** puts the list away and leaves the word alone — nothing is ever rewritten that you did not choose;
- and typing a word that happens to be an id **arms nothing**. Only a row you took off the list puts a node on your message; the panel reads back its own words and never yours.

A dismissed completion stays dismissed with that conversation’s draft when the panel is closed, another node chat is selected, or the plugin runtime rebuilds. Returning to the draft preserves Enter as Send. A different token or a new message can offer completions again.

While the list is up the keys are the list's: ↑/↓ walk it — through both blocks, one cursor — Enter or Tab take the row, Escape closes it. A click does the same for a hand already on the mouse. It is the same box the `/` commands use, because it is the same gesture.

**And Enter takes a row of the list you are looking at.** The node half is asked of the server, so it settles for a fifth of a second before it asks and those rows hold still until the next ones land. Enter inside that gap writes nothing rather than putting the word before last's node into your sentence and arming it; the rows catch up a moment later, and the same key takes the one you meant ([editing.md](editing.md) says it where the other lists in this app say it). The FILE rows are matched in your own tab, so they are never behind anything: `@cab` and Enter writes a path at once, as it always has. And a click is never held back at either half — your hand is on the row you can see.

## Pointing back at a node

Ids in the panel are pressable, and pressing one shows you that node: the row scrolls into view and says it is the one being talked about. If it is not drawn on the page you are reading — another outline, a branch you have collapsed — you are landed on its own file's page instead, unfolded to the row and sat on it, because *show this node* promised the row and a collapse may not hide what an address asked for. Neither may the page's DONE PICK: a landing whose target exists but is hidden as done **reveals it for the visit** — it is the row somebody was SENT, and the pick is a default, not a wall. The reveal mints nothing: the flip's strip and its `·` stand exactly as you left them (the page's own word and the panel's default are never touched, and leaving the page ends the courtesy — the pick hides the row again on your next visit, which is what it says). The address in the bar is the row's own (`house.olai#order`), never the zoom (`/#id` stays the permalink it always was). That `#` half may also spell a PLACEMENT's own id — `house.olai#kitchen-herbs`, the mirror's own record rather than the node's, which is how `outlines_read`'s `mirrors` hands a board row to whoever asks: the landing lands on the mirror row itself when the page draws it, and when the page does not, the id resolves the way the backticked press below resolves it — to the node the placement stands for — and the landing's own depth-first rule answers for that. And a fragment naming no row the opened page draws says so rather than arriving silently at the top of it: one alarm line in the voice every refused act in this app speaks, gone the way transient notices go, because a broken link and a working one used to be the same screen.

Three things in the conversation are ids, and none of them is a syntax anybody had to invent:

- the **chips on your own message**, which are the nodes you asked about;
- **what a write changed** — every edit the agent makes through olai's tools draws a line naming the node, and that name is the node;
- **an id the agent wrote in backticks**, which is how it spells one anyway, because that is how every one of these tools describes its own arguments. A backticked word becomes pressable exactly when the set declares it: `notes.md` and `commit: off` stay what they are. An id that names a MIRROR shows you the node it is a placement of — the same place a `see` to that mirror lands, and the only one there is: a mirror is drawn wherever its target is, and it is the target a row stands for.

**Which of them are ids is asked of the server**, once per message — the browser used to answer it out of its own copy of the whole directory, and that copy is what it is giving up ([brainstorming/vault-in-browser.md](https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md)). Two things follow, and both are visible:

- a backtick is **plain until the answer lands**, a beat after the words. It is never marked on a guess and unmarked afterwards: a reference that vanishes under your cursor is worse than one that arrives a millisecond late.
- the answer is **what the set said when the message was drawn**. A message is a record of something that happened; a node named an hour ago keeps its mark in that paragraph, even after somebody put it away — and pressing the mark then goes quietly nowhere, because *show this node* cannot be answered about an id nobody draws. The next message that names it asks again.

If the lookup itself fails, the panel says so at the end of the conversation — one line, because one question carries every message's ids. The words are all still there; what is missing is which of them can be pressed.

**A link the agent writes is a link**, and it behaves like every other link in this app: a path to a document (`notes/plan.md`) or an address of olai's own (`/house.olai`, `/#order`, `/today`) opens in the pane you were last reading, in place, with the conversation still beside it — and Alt+click opens it in a pane to the right. A `https://` one opens in a new tab, so a click can never throw the app away.

## What it shows when it changes something

A tool call is one folded line, and what the call CHANGED is not folded away — the arguments are what was asked for, and this is what happened to your files. There are two kinds of change and the panel draws them differently, because they are different things.

**The name on that line is the one the call was announced with**, and it stays put for the life of the call. An agent may rewrite a call's title as it goes — the tool's name while it starts, a sentence about what it is doing while it runs, something else again when it fails — and a row that followed along would rename itself two or three times while you were reading it, taking the name of any lane hanging off it with it. What the row says instead is what the call was called when it appeared. What it was asked, and what came back, are in the fold, where a call's detail always is.

**A file the agent rewrote** — a `.md`, a source file, anything that is not a node — shows its diff, right there in the conversation: the path, how many lines came and went, and the change itself, with the unchanged stretches between two edits collapsed so what you read first is what moved. A long line wraps inside the change — the line number and the +/- stay in their column — so the conversation never grows a horizontal scrollbar. It is TRIMMED to a few lines, and a click opens the rest where it stands. That is the one thing the transcript is for here: an edit like this appears in no outline, so before it was drawn, the only way to see what an agent had done to a file was a terminal.

An edit a SUBAGENT made is drawn the same way, in that agent's own shelf rather than in the conversation — see [when the agent sends other agents](#when-the-agent-sends-other-agents). Same box, same trim, same click; one door away, because the conversation is the main agent's.

**One edit can show up as several of those boxes**, and it is not a bug when it does: the agent reports what its patch actually did, one block per place the change landed, so an edit that touched three parts of a file is three boxes under the one name — each with its own lines and its own counts, each trimmed and expanded on its own. They are three things that happened to that file, and running them together would be the panel deciding they were one.

**An outline never gets a text diff**, and that is deliberate: an outline is one line per node, so a text diff of one would be a single enormous line with everything on it changing at once. What shows instead is what changed about the NODE, in the same words the Commit panel uses for the same edit — *marked done*, *note rewritten*, *moved* — with the outline it lives in and, when the rollup has something to say, its remark underneath. The tree in front of you has already moved anyway; this is the sentence that says which write did it.

That holds for the file rather than for the tool: an agent that edits a `.olai` with its own tools gets the same node-level rows, read out of the two versions of the file, and never lines. If one of those versions does not parse — which is how hand-editing an outline goes wrong — the panel says so and still draws no diff, and the file's own page shows you the validator's rows where they belong.

## How long a call has been running

**A call that is still going says how long it has been going**, on its own line, once it has been running long enough to be worth saying:

```
· grep for worktops                      src/kitchen.ts   · 47s
```

The mark at the head of that line is the only other thing on it about time, and it cannot answer this: `·` is what a call announced a quarter of a second ago wears, and `·` is what one that has been grepping for four minutes wears. So the question you actually have — *is this stuck, or is it working?* — had nothing on screen to answer it. The number ticks, seconds while seconds are the question and minutes once they are not (`47s`, `1m 12s`, `1h 20m`), and it appears only after a few seconds, so the reads and edits that land instantly never flash one.

**It knows nothing about tools**, and that is the point. What earns a number is the status on the wire — the call has not come back — so a shell command, a file watcher, a build, a search, and the tools of some agent olai has never been pointed at all get it, with nothing here having to recognise any of them.

**It shows what the wire calls running**, which is not quite the same as what is running, and guessing at the far side of somebody else's process is not something this panel will do. That distinction used to cost you the longest-running rows in the panel: a monitor, or a shell command sent off to run in the background, arrived here already complete because the tool answered at launch. The fix went where the problem was — the wire — and is a section of its own below.

**And it stops when the call's TURN does**, which is a stronger promise than it sounds. A status is sticky, and the rows a dead or abandoned call leaves are deliberately still on screen to read — so a call nothing ever reported back on says *pending* for as long as the panel is open, which is the honest record of what happened. A clock asked of that alone would count up all afternoon under a process that stopped at lunchtime, which is the same lie the rail under a spawn is careful not to tell, except that a wrong word stays the same size and a wrong number grows.

*Whether this conversation is busy* is the near-miss, and it is worth saying why it is not the question. Ask again after an agent has died — the rows are still there, that is the point of leaving them — and the new turn makes the panel busy again, so every call the last turn walked away from would light back up at once, each with a clock counting from when it first started. So olai marks what each turn leaves behind, on the call, and a later turn cannot take that back.


## When the agent leaves something running

Some calls do not finish when they answer. The agent arms a **monitor** — a command whose every line of output is an event, a websocket it watches, a `kolu watch` over a fleet of terminals — or sends a shell command off with `run_in_background`, and the tool answers immediately: *started, here is the task id*. The work then goes on, past the answer, past the turn, and for a persistent monitor for the rest of the conversation.

That used to be invisible here, and the incident is worth keeping: an orchestrator armed `kolu watch --states waiting,awaiting --held-for 60s --nag 10m` and supervised an entire dispatch off its events, and the panel showed none of it — no arming, no liveness, no death. The person watching had to ask *how do you know you are babysitting right now?*, and the answer — a pid, an event cadence — existed only in the agent's own prose.

**A background task gets the row of the call that armed it, and that row stays live:**

```
… kolu watch --states waiting,awaiting        ◷ kolu fleet watch   · 12m 4s
  │ still running…
```

What is on it is what the harness itself says: the **description** the task was armed with, which is what you recognise your own watch by (the call's title is `Bash`); the **clock**, which is the same readout every running call gets and ticks here for as long as the task is out; and the **rail** under it, the same one a spawned agent hangs, saying something is still going on down there.

**While it is out, it is at the top of the panel too** — a strip under the header, beside the one naming this conversation's tool servers, saying what is running and for how long:

```
● kolu fleet watch 12m 4s
```

That is not a second copy of the row. A background task's row is at its *birth position*: a monitor armed at the top of a three-hour session is three hours of scrollback away by the time you wonder whether it is still up — and you wonder at the bottom, where you are. The strip is above the scroll and never carried away by it, so the question has an answer wherever you are reading. It is absent when nothing is running, which is nearly every conversation.

**An agent the turn sent out is on that same strip**, for the same reason and one step further — pressing it opens what that agent is doing. A background task is not pressable, because a task's own events reach nothing olai can read. That half is [below](#when-the-agent-sends-other-agents).

**And its death lands where you are looking.** When the task ends, the strip clears and a fresh row arrives at the bottom of the transcript, at that moment:

```
Background command "kolu fleet watch" failed with exit code 3
```

The row that armed it keeps its own ending — it is the record of what happened to that call, and scrolling back to it shows the whole story — but the *news* is delivered at the end of the transcript, because a death edited only into history is a death nobody meets. Where the harness sent no sentence with the ending, the row says the plain thing instead: *the background task "kolu fleet watch" ended (killed)*.

**Its death is on the row too, and that is the point.** A monitor that dies is precisely the fact you must not miss — the supervision stops and nothing else says so:

```
✗ kolu watch --states waiting,awaiting   ◷ kolu fleet watch   · failed
  Background command "kolu fleet watch" failed with exit code 3
```

The word after the description is the **harness's own** — `completed`, `failed`, `killed`, `stopped` — because the protocol's four statuses cannot spell the difference, and a monitor you STOPPED did not fail. The sentence under it is the harness's too, and it is drawn without unfolding anything: for this one row it is the whole of what there is to read, and an exit code behind the same click as the arguments is an exit code nobody sees.

**A turn ending does not touch it.** Every other call still running when a turn ends is marked as one the turn walked away from; this is the one kind of call whose whole point is to outlive the turn, so it is left alone and goes on ticking through the next turn, and the next. What DOES end it is the agent dying — a dead agent will never report anything again, so its tasks are abandoned along with its calls and the live faces go out together.

**The honest limits, per layer**, because they are not all in the same place:

- **What the panel draws** is the task's life: armed, still out, and how it ended — in three places, each answering a different question. The ROW is the record of the call; the STRIP is the standing answer to "is it still up?"; the row at the bottom is the news of its ending. Not its individual events, and the strip says nothing about when it last did something, because nothing knows.
- **What the wire carries** is exactly that, and only because olai patches the adapter it ships with (`packages/plugins/claude/acp/patches/README.md`). As released, that adapter completes such a call at the moment it launches — the acknowledgement read as the result — so an armed watch and a finished one were the same row and there was nothing to draw a clock or a death from. The patch is [PR #941](https://github.com/agentclientprotocol/claude-agent-acp/pull/941)'s approach on [issue #865](https://github.com/agentclientprotocol/claude-agent-acp/issues/865), extended from async agents to every task the harness registers.
- **What nothing carries** is the events themselves. A monitor's every line reaches the model and the task's own output file, and no message in the stream underneath the adapter carries one — measured, not assumed. What you see instead is the agent's own prose about each event, in the short turns the harness wakes it for, in the agent's voice where it belongs.
- **An agent that is not Claude Code** says none of this, so its background work is drawn as it always was: a call that completed at the moment it started. Nothing here guesses from a tool's name.
## When the agent sends other agents

An agent can spawn agents of its own — one to search, one to read, five at once — and their work comes back to olai on the same wire as everything else the turn does. **It does not come into this conversation.**

That is the ruling, and it came from a real turn: five survey agents and a monitor, and the transcript became a wall of other agents' `cd … && grep …` with the main agent's own words pushed off the top of the screen. The panel was reporting, faithfully and at full length, on work nobody had asked to watch. So the column here is the main agent's and only the main agent's — its prose, its own calls, and every question anybody stops to ask you. A subagent's calls are filed under the agent that made them, and read where that agent is: on the strip, and in the shelf behind it.

**The call that sent the agent out stays exactly where it was.** It is the main agent's own call — it is the record of what happened — so it keeps its place in the conversation, its title, its ending, and the agent's report in its fold. Scrolling back to it a week later still tells the story.

That report is how an async agent comes back, too. The harness injects the completion as a user-role turn — a `<task-notification>` block, stamped `origin.kind: "task-notification"` in the session stream — so the main agent can be woken with the result. That turn is not a message you typed and it is not the main agent answering: the report is filed in the spawning row's fold, the ending is the one-row news at the bottom in the harness's own words, and none of the XML occupies the column.

```
· read every note                        ↳ Explore
│ ● working…
│ ↳ 7 calls
```

**Under it, the rail says the agent is working and the door says how much it has done.** Press the door and that agent's calls open in a shelf above the conversation — the same rows, behind the same rail, with the same folds, the same diffs and the same clocks they would have had in the column. It is the same drawing moved, never a summary of it.

The door is drawn only once there is something behind it. An agent that has just been sent out has made no calls yet — its first act is to read its instructions, which produces nothing — and the rail above already says the true thing about that stretch. An agent that finished having called nothing has its whole answer in the row's own fold.

None of this is anything you turn on, and a turn that spawned nobody looks exactly as it always did.

### The strip is the other door

While an agent is out it is **on the strip above the scroll**, beside the background tasks, saying what it was sent to do and how long it has been gone:

```
● read every note 47s   ● review the notes 12s
```

That is the same strip a `Monitor` sits on and it is there for the same reason — a live fact you can only reach by scrolling is a live fact nobody reads — but for an agent it does one thing more: **it is pressable.** Five agents out is five entries and one shelf; press one and you are reading that agent, press it again and you are not. A background task is not pressable, and that is honest rather than inconsistent: a task's own events are on no wire olai can reach, so there is nothing behind that door and there never will be.

The strip goes quiet when an agent reports back. **The record does not go with it** — the door under the spawning row is permanent, because that row is permanent, and it is where you go when you want to know what an agent actually did an hour after it finished. There is nothing to dismiss and nothing that dismisses — what the strip says is what is out — so a shelf is put away by pressing a door onto it again. **Which door depends on when you are.** While the agent is out that is the strip entry you opened it from; once it has reported, the strip entry is gone and the door under the spawning row is the one that closes it, exactly as it is the one that opens it an hour later. That is the same permanence the record has, and it is why nothing here needs a control of its own: the shelf's only job is to show you an agent, and the thing that names the agent is the thing that puts it away.

**And its ending is still news, on every outing.** A background agent — one the harness registered a task for — says at the bottom of the transcript how each outing ended, the second one exactly as the first, because the row is an hour of scrollback away by then and the strip going quiet is the only other thing that could have told you. A subagent that arms nothing is quiet both times, for the reason it was quiet the first time: it reported into the fold of the row that sent it, and the agent speaks in the next breath. What never happens is one outing of a call being louder than another.

**And it lights again if that agent is sent more work.** A subagent can be resumed — a follow-up instruction over the same transcript, an hour later — and it comes back as the same agent: the same row, the same door, the same entry on the strip, with the count behind that door carrying on from where it stopped. The clock restarts, because it is answering *how long has this been out* and the agent went out again a minute ago; the row's own stamp does not move, because that is where the record starts. Everything the agent does is filed under the call that sent it out in the first place, whichever outing it is on, so there is never a second face for one agent.

### An agent that does not come back

**A subagent's death is said at the end of the transcript, where you are looking**, and not only on a row somewhere above:

```
the agent “survey the web package” ended (failed)
```

It is the same rule a background task's ending follows and it matters more here, because a subagent's calls are no longer in front of you: a fan-out whose agents quietly stop leaves nothing on the screen that changed. So the news comes to the bottom, at the moment it happens, in the harness's own word where there is one — and in olai's own where there is not, which is the turn ending with the agent still out: *the agent “…” ended (never reported back)*.

An agent that came back FINE says nothing here, and that is the difference from a background task. A monitor's completion is news on a row that has been saying *still running* for an hour; a subagent has just reported into the fold of the row that sent it, and the main agent speaks in the next breath. A line per agent per fan-out would be five rows of furniture under an answer.

**A whole agent dying is still one sentence, not one per agent it had out.** When the conversation itself falls over, that is what the panel says — once, at the bottom — and the rows every abandoned agent left are still there to read.

### When it is a subagent that asks

A spawned agent can stop and ask — permission for a tool nothing recognises, or a question with options to pick from — and **the form is in this conversation**, not in that agent's shelf:

```
· explore the outline                    ↳ Explore
│ ↳ explore the outline
│ ┌ Allow `rg --files`?
│ │  [ Allow Once ]  [ Deny ]
```

That is deliberate and it is the one place the rule at the top of this section does not apply, because a question is not the subagent talking. It is a question **to you**, it blocks the turn, and a turn blocked on a form nobody meets hangs for as long as you fail to notice. A form behind a click is a form nobody presses — so a question was never subject to being moved, and there is no state of the panel in which one is hidden.

It is drawn indented behind the same rail its calls would have been, **with the lane naming who is asking** — always, on every form, wherever it sits. The reason is what a form is: the one row here where being wrong about who is speaking changes what you press. And you rarely meet it by reading down to it — a blocked question is announced in the composer, in the header and on the app's agent toggle (the thumb strip, on a phone), so you come looking for a form that may be anywhere.

**That name is what the agent was SENT to do**, and it is worth saying where it comes from, because it is not the title on the row above. An `Agent` call is titled with the tool's name — four agents dispatched in one message are four rows reading *Task* — and a row's title is fixed at the first thing it was called, deliberately, so a call cannot rename itself while you are reading it. The short description the agent was sent with is a different thing, and it is the one every surface here uses: this label, the strip, the shelf's head and the door. It matters most here. Before, a form you doubted had that agent's whole stretch of work under it to read; now its calls are elsewhere, and this line is the only evidence on the row of whose question you are answering.

The form is not copied into the shelf either. One decision drawn as two forms is one of them pressed by somebody who cannot see the other; so a run with a question in it reads as a gap in that agent's calls, and the answer is where the conversation is.

**And the shelf says so.** Reading one agent's work while another stops to ask is the one way this panel could have let a form arrive somewhere you were not looking — so the shelf carries a line saying a question is waiting, and pressing it puts the shelf away and takes you to the form. It is the same press the alert banner makes, and there is still only one form.

**What is deliberately not drawn at all is the subagent's own prose.** The agent olai ships with does not send it: a spawned agent's text and thinking are stripped from the feed unless a client asks for a nested transcript, and olai does not ask. So a running subagent is its calls and its status here, and the one place its own words appear is the report it hands back at the end. That is a floor rather than a preference — but it also means the main agent's voice in this panel is only ever the main agent's, which is worth having.

### What an agent whose feed says none of this looks like

Nothing above is guessed from a tool's name. Whether a call sent an agent out, and which agent a call was made inside, are two facts olai reads off the frames — and an agent that carries neither (opencode does not) is drawn exactly as it always was: one column, every call in it, no strip entries, no doors and no shelf. That is the direction this is safe to be wrong in, and it is the direction it is wrong in.

## When it is waiting on you

A turn that stops on a question does not time out and does not carry on. It hangs — for as long as it takes you to notice — so the panel's job is to make sure you do.

Each question keeps its own draft answer. Switching between node agents, folding the conversation or changing an unrelated plugin preserves the unfinished answer for the agent that asked it. Another agent asking the same fields starts empty, and restarting the harness does not carry an abandoned answer into a new question.

**If the conversation is in front of you, the form appearing is the whole of it.** It arrives where you are already looking, the composer says the agent is waiting on you, and nothing rings. A notification about something already on your screen is nagging, and the surest way to make somebody switch these off.

The one place *where you are already looking* is not the conversation is the shelf that previews one agent's work, and that is why it carries the notice itself — see [when it is a subagent that asks](#when-it-is-a-subagent-that-asks). A surface that takes your eye off the transcript owes you the sentence the transcript would have given you.

That counts ANOTHER TAB of the same olai, too. Two tabs are two documents and one person: the one you are reading says so to the others, so the tab behind it does not chime about a form you are looking at. A different olai — another directory, another address — is not caught by it, and goes on telling you.

**If it is not** — the window behind an editor, the conversation folded away, olai on another desktop — three things happen at once:

- **one short chime.** Two notes, a third of a second.
- **a system notification**, naming the conversation and the question when a live reading has its text. An unread conversation is reported without quoting stale text. Clicking brings olai forward and unfolds the first agent in Needs you order. With nothing waiting it opens no fold.
- **a mark on the app's icon** for waiting questions, plus the tab-title and favicon attention mark. The server roster supplies each current session's count, so several conversations can contribute. Looking at the conversation acknowledges its attention; dismissing a system banner does not answer the question.


**A turn merely FINISHING is silent, on purpose.** An agent that has finished will still have finished in five minutes; a chime for every turn is a chime people switch off, and it would take the one that matters with it.

Two rows owned by **chat** in **preferences** decide its alerts — **Alerts**, and **Alert sound** beneath it — and both start ON. They are two rows rather than one because they are two questions: turning the chime off in a quiet office should not also cost you the notification. Turning Alerts off silences all three, and puts the icon back.

A third row, **Reminders**, belongs to the journal and defaults on. It sends a daily
notification about owed work through the same channel. A reminder is not a
question and never badges the icon or marks the tab. Its chime is best-effort:
without an earlier gesture in this page it is skipped, never replayed.

The notification is the one part that needs the browser's permission. olai asks for it the first time it actually has something to tell you, which is when the question in the prompt is about something real; if your browser only allows that prompt after a click, the Alerts row carries an **Allow notifications** button. Refuse it and the chime and the icon mark go on working — neither needs permission.

**The honest limit: olai has to be running.** The alerts ride the same live connection everything else in this app does, so they reach you with the window in the background, on another desktop, or behind everything — but a completely closed olai is not listening, and nothing wakes it. There is no push server, and adding one is its own decision rather than a detail of this.

## Attachments

You can paste a file into the box — a screenshot, a photo of a whiteboard — or drag one onto the panel, or pick one with the **+** button — one of the two doors a phone has; the other is the camera, next paragraph. All of those take the same kinds:

- **pictures**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico`
- **documents**: `.pdf`, `.txt`, `.md`, `.csv`, `.json`

**On a phone the `+` has a camera beside it.** One tap opens the camera itself rather than a picker: shoot, the photo lands in the strip above the box like any other attachment, and you can shoot again — tap the camera, one more photo joins the strip — until one send carries them all into the same message. It is drawn only where there is a finger to press it: a desktop has no button at all, because a "camera" that opened a file dialog would be a control that lies, and the roll is exactly as reachable there either way. A picture the list above does not take — say a camera that answers with a `.heic` — is named in the refusal, the same as a drop that misses the gate.

The bytes go into a temporary directory belonging to that conversation, never under the directory being served, and the agent is handed the PATH: it reads the file itself, so nothing rides the prompt into the stored session, and nothing attached here can end up committed with your outlines. The files go away when you start a new conversation or stop the server.

Closing the chat drawer or changing an unrelated plugin preserves pending files,
including uploads still being read. Each live node conversation keeps its own
attachments when you switch nodes. Sending removes the pending chips; the sent
message keeps its attachment list. Restarting chat clears temporary uploads even
when it resumes the same stored session, and delayed uploads cannot cross into a
different conversation.

A picture shows itself in the strip above the box. Anything else shows its name and how big it is, because a PDF has no thumbnail worth drawing and a broken image icon is a lie about a file that arrived perfectly.

Dropping is aimed at the whole panel rather than at the box: while you are dragging over it the panel says so, and what lights up is what will take the file. Several files in one drop attach in the order you dropped them, and they reach the agent in that order. Anything olai will not take is named where it was dropped — an SVG (a document that can script, whatever the drag calls it), a `.zip`, a file over the 50 MB cap — so a drop never disappears quietly, and whatever it can take in the same drop still attaches.

## kolu

If the machine is running [kolu](https://kolu.dev) — terminals for coding agents — the panel's agent gets kolu's terminals too, and there is nothing to set up: every new conversation looks for the padi daemon this host answers on, and hands the session `kolu mcp` when one is there. It is looked for rather than assumed: olai starts the `kolu` it found and asks it to read something only a running daemon can answer, because a `kolu` on a PATH is not always the one this host is running, and a wrong build will start perfectly well and know nothing.

## odu

The panel's agent gets CI its own way: every new conversation resolves `odu` on the server's PATH, starts it, and hands the session `odu mcp` when it answers — the run verbs (`run_start`, `run_retry`, `run_cancel`, `run_wait`, `venue_hold`/`venue_release`) and odu's own resources, with no olai-invented verb among them. Every documented way of starting olai — `nix run`, the packaged binary, `just serve`, the home-manager unit — bakes the pinned [odu](https://github.com/juspay/odu) onto the server's PATH, so what gets resolved is the build's own binary, not whatever a machine happens to have installed. It is still probed rather than assumed, and the probe asks the one question only the right build answers: every one of those verbs must be aimable per call, because a conversation spans every lane on its board while the server itself is spawned in one directory — a `checkout` on the verbs that name a directory, a globally-resolvable `runId` on the ones that name a run. An answer without them gets the sentence, not the tools — and *no answer at all* gets one too: a serve whose PATH carries no `odu` is a miss the panel draws, never a quiet plugin (see [below](#when-a-tool-server-does-not-arrive)). [odu's own page](plugins/odu.md#the-chat-panels-odu) has the whole of it, including which half of the face stays parked in the server's own directory; [odu's PR #105](https://github.com/juspay/odu/pull/105) is the shape this asks for, and [#97](https://github.com/juspay/odu/pull/97) is the checkout-targeting one it grew out of.

## Which tool servers a conversation has

**The conversation lists its tool servers.** Above the transcript is the list of MCP servers this conversation was handed:

```
olai ✓  kolu ✓  · plus the agent's own
```

Ask an agent which MCP servers it has and you are asking the worst-informed thing in the room: nothing in a conversation's context is a record of what it was handed. The incident that filed this feature is exactly that — an agent asked the question listed two servers, left out kolu, and then used kolu's tools perfectly a moment later.

**A tick means the agent said so.** It is the one mark olai will not infer. A name with no tick means olai handed the server over and nothing has said what became of it — which is every row before the first turn (the agent reports its servers as a turn starts, so a brand-new conversation has been handed them and nothing more) and every row for the whole life of a conversation with an agent that does not report per server at all. ACP itself never does: `session/new` answers with a session id and not one word per server. The Claude Code adapter volunteers it on its own channel; opencode does not, and its conversations draw names without ticks rather than ticks nobody asserted.

**`plus the agent's own` is not a hedge for the sake of one.** Olai lists what olai handed over. Whatever your agent is configured with of its own — a server in your `~/.claude.json` or `opencode.json` — is set up somewhere olai never looks, and olai will not draw a row it has no way to keep honest. So the list is exactly as complete as it says it is.

**A server the agent could not attach says so, in the agent's own word.** `needs-auth` and `failed` are different problems with different fixes, so the panel repeats the word rather than flattening it into "did not attach".

## When a tool server does not arrive

**A server that fails to attach is on screen, not in a log.** If there is a tool a conversation would have been handed — kolu's `kolu`, odu's `odu` — on this host's PATH and it would not answer, the panel says so under the roster — the name, and the reason the probe or the server itself gave:

```
● kolu is missing from this conversation
  it refused to read the daemon's identity: surface-mcp: padi transport down
  /nix/store/…/bin/kolu
```

The reason is the point. Every way of failing looks the same from the outside — the agent simply has fewer tools — and they want different things done about them: a padi that is not running is one thing, a `kolu` that is an older build missing half its verbs is another, a file on PATH that will not run at all is a third, and one that reads and never answers is a fourth. (There is a fifth sentence, `talking to it failed: …`, and seeing it means something unusual: the reason a broken pipe reached you before the reason the file would not run.) The path is there for the same reason: a padi-spawned terminal prepends its own bundled copy of kolu, so *which* one answered is the question this usually turns out to be — and the one failure with no path to name says so instead.

**`PADI_SOCKET` counts as somebody saying kolu should be here.** If the variable is set — a kolu terminal sets it for what it starts, and a person who set it by hand meant it — and there is no `kolu` on the PATH this server was started with, that is a miss and the panel says so. It is worth knowing because *olai's* PATH is not your shell's: run as a systemd user service (the home-manager unit), it inherits neither, so a kolu you can run in a terminal is not necessarily one this process can see. That was the original mystery from the other side.

It is per conversation, because the detection is: start a padi and the next conversation has the terminals, with nothing to restart and nothing left on screen saying otherwise.

**A machine that is simply not running kolu sees none of this**, and that is deliberate — nothing failed. It has no row on the roster either: what the panel reports is a tool server that was here and would not work, or one something said would be; never the absence of one that was never installed.

An agent's report never overrules the probe. If this host's `kolu` would not answer, the session was never given one — so an agent that reports a `kolu` is reporting a `kolu` of its own, out of its own config, and the row here goes on saying what olai found.

**For odu the rule is one notch stricter: the build itself says odu should be here.** A packaged olai — `nix run`, the packaged binary, the home-manager unit — carries the pinned `odu` on the server's PATH (`just serve` answers the same question from the tree; [running.md](running.md) has the one knob, `OLAI_ODU_BIN`), so a serve that resolves none IS an absence the panel draws: no `odu` is on the PATH this server was started with, with the build's promise beside it and no path beside the name — nothing was resolved, so there is nothing to name. There is no quiet case to mistake it for, and that is the point of the rule: a machine that runs all its odu through `nix run github:juspay/odu` installs nothing anywhere persistent, which is exactly how a serve started outside the build used to have no CI verbs *and nothing on screen saying why* — the one production shape this arm exists to name.

## What this conversation wakes on

**A plugin can put a message into this conversation, and you decide which one it may put it into.** Under the roster and the strip of what is running is a third line — one per plugin that has something to watch — saying what the wake would be about and which file you pointed it at:

```
wake on terminal activity · terminals from  [ lanes.olai ▾ ]   3 fleet events waiting
wake on CI runs · runs from  [ lanes.olai ▾ ]
```

**For every conversation, off is the state you start in, and it is drawn rather than hidden.** No serve turns a scope on for you, no setting does, and no agent can — the verb behind the picker is the browser's alone. A new conversation, and one you cleared, wakes on nothing until you pick a file, and the row says `off` so that the control is somewhere you can find it before you have ever used it. Node-bound chats have the same picker. Each plugin has its own choice, saved per conversation across restarts; selecting another file changes only that plugin, and `clear` turns it off and discards its queued notifications. `clear` is the way back, and it is the same one fact with an empty value rather than a second switch.

**The picker offers the files that could actually be a scope, and that is fewer than the directory holds.** A plugin says which KINDS of file its doorbell can be pointed at — kolu says outlines, because what it reads is the terminals a file's un-done rows claim and only an outline has rows — so a document is not on the list. It used to be: a `.md` sat between the outlines, and a conversation pointed at one heard nothing for ever while the heartbeat below went on saying the watch was running, which is the one thing that must never happen. Beyond the kind, the list is the outlines *you* keep: what is in the Trash and any leftover `Archive.olai` are left out, because a lane you put away claiming a terminal is history rather than live work, and so are the files olai made for itself under `_olai/` — the shelf, the property declarations, the inbox, kolu's own knobs — which are outlines that will never carry a lane. Everything else you have is offered, in full, because which of your outlines is a board is not something olai can know and it will not guess.

**The chosen file is the whole scope, and what it MEANS is the plugin's business.** olai never opens it. kolu reads the terminals your board's un-done rows claim and tells this conversation when one of them has stopped and is waiting on a person — see [kolu's own page](plugins/kolu.md) for exactly what it says and when. odu reads the `odu-worktree` values on those same un-done rows and rings when a claimed run first goes red, and again when it settles — [odu's own page](plugins/odu.md#the-ci-doorbell). Pick the board you are working from and you hear about the lanes on it; pick nothing and you hear nothing. That also means picking a *different* file is how you go quiet about one board without going quiet about the tool. A node-bound conversation can choose any eligible outline, including one outside its node's file. Binding a chat to a node does not subscribe it to Kolu or Odu.

**A message a machine sent looks like one.** It is in the same lane your own messages are in — that is the lane a prompt goes out on — but it is drawn as the full column on the left, never the tinted bubble on the right that means *you said this*, and it opens by naming who is speaking and when. That opening line is not decoration: a conversation you resume later is rebuilt out of the agent's own store, which carries the words and not the mark, so the sentence has to say for itself who wrote it. There is no *send again* under it either — what it says is how something STOOD when it rang, and re-sending that an hour later would be re-sending a claim that has stopped being true. Whatever rang will ring again.

**And it is one line until you ask for the rest.** A doorbell's account can run to several paragraphs — which terminal, which step it is claiming, what the claim was derived from, what else is waiting, and how to make it stop — and all of that unasked, in the middle of a conversation, is a wall. So the row draws the plugin's own opening line with a small ▸ in front of it; press that and the account opens under it. Hovering the line shows the account too, as a second way in rather than the only one. The agent is handed the whole thing either way — it has to act on the ids in it — so what folds is what you are shown, and nothing else.

**Ids in it are pressable, the same as ids the agent names.** When a plugin writes a node's id in backticks — the lane it is ringing about, say — that name is a reference: press it and you are shown the node, exactly as [pressing one in the agent's own prose](#pointing-back-at-a-node) does. That is the reason the line's text is not itself a button any more: the ▸ opens the row, the id goes to the node, and nothing has two meanings. Nothing else in a machine's sentence is interpreted — no headings, no lists, no links — because those words also have to read correctly when you resume the conversation later and the panel no longer knows a machine wrote them.

**It waits for the turn to end rather than joining it.** If the agent is working when a plugin rings, the sentence is held and the count on the strip says how many are waiting — because the alternative to holding words out of sight is not dropping them, it is showing them. It arrives whole at the boundary, however that turn ended, cancelled included. This is not a queue behind the composer: what you type is never held anywhere, and a message that goes out while a turn runs still goes out. It is the machine that waits, and the reason it waits is that an agent interrupted by a message nobody typed would spend an interruption you were saving.

**A doorbell that stops watching says so, once, and the strip keeps saying it.** Two things can do it. Somebody renames, moves or deletes the file you pointed it at; or the file is one your doorbell cannot read — which today can only be a pick you made before the picker started filtering, since the list will not offer you one now. Either way the plugin puts one message into the conversation, in its own words, saying that nothing is being watched any more and what to do about it — and the strip stops drawing the control as on: the file's name stays, so you can see which one it is about, with `gone — pick another file` or `not one this can watch — pick another file` beside it. The picker still opens, because picking another file is the fix.

**Once, and not once per anything.** The message is sent on the change and never again while it stands, a restart does not repeat it, and the heartbeat stops with it — a doorbell that is watching nothing must not be able to send you the sentence that means *the watch is running and had nothing to say*. Point it at a file it can watch and everything starts again, quietly: the strip goes back to normal and nobody tells you it recovered.

**A saved change ends the previous choice.** Once clearing or changing a file succeeds, work derived from the old choice cannot enter the transcript, including missing-file warnings waiting for an agent to start. Picking the same file again also ends the old choice. A failed save leaves the previous choice in effect. Turning a plugin off ends its outstanding deliveries; turning it back on restores the saved picker setting without reviving those deliveries.

**Held sentences are held in memory, and the picks are on disk.** Restart the server and it comes back knowing which conversations wake on which files, holding nothing — which loses nothing, because whatever derived a held sentence looks at its own subject again and rings again.

**Thirty-two picks are kept for this directory, and the oldest one you touched drops off.** A pick is one conversation pointed at one file for one plugin, and the file they live in holds thirty-two of them: make a thirty-third and the row nobody has touched for longest is evicted, which turns that conversation's doorbell off — the strip on it says `off` again, and picking a file there brings it back. It is a count rather than a question about which conversations still exist, because an agent's list of sessions is paged, so *not on the list* is not proof of *gone* and a prune that trusted it would silently delete a doorbell somebody set. A conversation you keep coming back to is a conversation you keep touching, so in practice this is the number that clears out seats you stopped using.

## Node agents

A node with a `chat-agent-session` property is an agent. Its title is its name, its
note is its charter, and its subtree is its memory. The property names an engine
and, once bound, a conversation: `claude` or `claude:<session>`. The usual declared
key is `chat-agent-session`; a vault can declare its own key for that kind.

### The standing and the conversation

The outline row's aside, beside its child count, draws the engine mark, standing
dot and word. Working and starting agents show an elapsed clock; an asleep agent
with a last-heard line shows its age. Press the standing to unfold the
conversation under the row, above its children. Press again to fold it. An
unbound standing says **no session bound** and cannot be pressed.

Several rows can be unfolded at once. Each fold owns its reading and releases
it when folded, removed, trashed, navigated away from, or withdrawn during a
plugin rebuild. Releasing one reading does not stop another fold or tab reading
the same conversation, and does not cancel ongoing work.

The fold begins with the agent line: engine, model, context usage, working cue,
**fresh start**, and **open the page ›**. Its transcript is bounded; the composer
and activity controls remain below it. Zooming into the node puts the agent line
under the title and above the property drawer, the subtree below the drawer, and
the conversation and composer after the subtree. The page's transcript is
unbounded and the containing pane scrolls. Head and foot share one reading per
page; two panes remain independent readers. The session property is omitted
from outline rows and remains editable in the zoomed drawer, with its ordinary
folding behavior. Phone and desktop use these same faces; there is no chat sheet
or fixed right dock.

### Starting an agent

Hover or focus a plain row to reveal **start an agent** in its aside. One engine
starts immediately; several offer their names in a small menu. The row menu
retains **Start an agent session**, including for keyboard and phone long-press
use. With no engine available there is no start pill or menu entry. A successful
start opens the session first, writes its binding second, then unfolds the row.
A refusal stays on the row and creates no false binding.

A zoomed plain node carries a dashed composer: **ask about <title>…**. Sending
starts its agent and delivers the draft to that conversation. The subtree
remains visible throughout. A bound node instead uses **fresh start** to replace
its conversation.

### Needs you, Recent, and the palette

**Needs you** lists agents waiting for answers before agents that are not
running, newest activity first within each group. A row shows its question count
or **not running**. The region disappears when empty. **Recent** lists every
standing, capped at ten: last-heard activity first, then nodes without speech by
their vault edit time. These rows show an engine mark, title and age, with no
standing word or dot. An agent may appear in both regions.

Pressing either row navigates to the node in its outline and unfolds it; an
unbound agent navigates only. The open row is marked current. Search **Agents**
or a title in the palette to reach every agent, including those beyond Recent's
cap. Palette rows name their standing and use the same navigation rule. Both
regions and the palette contribution withdraw with chat.

The **new chat** row heads Recent and the Agents palette. It ensures `Chats` in
the Inbox, mints a child titled **new conversation**, then starts its chosen
engine and unfolds that child. With one engine it starts immediately; several
offer engine names, in the sidebar menu or as palette rows. Both faces share one
pending creation gesture. No Inbox entry means a refusal without creating a
conversation. A refused start leaves its already-created plain node available
for another start; independent Ops writes are not rolled back.

### Where the binding lives, and what a second machine sees

The binding is in the vault, on the node. Moving or renaming the node preserves
it. A session id is machine-local: another machine draws the node but its own
engine may refuse to open that conversation. Starting fresh there writes a new
binding, replacing the first machine's pointer. The subtree remains its memory.
Trashed nodes and nodes whose property was removed disappear from the roster.

Machine-local `heard/` records keep what olai observed: teaching, assignment,
replacement links, and the last line heard. They are keyed by engine and session
and capped at thirty-two conversations, least recently overheard first. They
are bookkeeping, separate from the keyed model choices and wake preferences.
Eviction can cause a contract to be taught again. A last-heard line is the
agent's prose observed by olai, not a tool call, question, or invented summary;
a conversation driven only from a terminal does not update it.

### An agent-associated session is taught what it is

The first accepted message carries a preamble naming the node and its subtree
as memory, and the transcript as history. The same words appear under your
message as a notice. This uses the ordinary prompt seam because ACP has no
system-prompt field, and costs no separate turn. Teaching is recorded per
session and survives restarts. A refused send marks and displays no teaching.
A missing or trashed node teaches nothing. If recording the teaching fails,
the next message can repeat it; the transcript does not claim a record the
machine could not retain.

A filed session gets the assigned-session contract: it was moved here and must
write what it knows into the subtree now. A session opened for a node gets the
ordinary contract. Neither requires copying or converting the engine's session
files.

## Moving the chats you already have

### Filing stored conversations into the Inbox

The chat server files unclaimed conversation heads automatically. Capture owns
an Inbox-path entry in the vault's scoped registry; chat reads absence without
naming a capture service or waiting for it. No entry means no filing, with the
absence logged at boot and registry transitions. An entry appearing starts a
full run; withdrawal stops filing without disabling chat. Work belongs to the
chat server scope and is interrupted when that scope closes. There is no clock.

Full runs ask every installed engine after discovery at boot and each session
revision. Running engines answer live; others are started, asked and stopped
one at a time, with short-lived reuse of their answers. Each settled node-agent
turn also triggers a narrow run asking only its already-running engine. It
starts no process and asks no other engine. Thus a terminal conversation is
filed after the next settled node-agent turn on that engine. Unreachable engines
are logged with their reasons and retried on the next run.

The filer ensures a top-level `Chats` node with reserved id `chats` in its own
Ops write, then makes one independent write per unclaimed head, newest first.
A refused Chats write stops the run. A refused row leaves its neighbors intact
and retries alone later. Each row rechecks claims, including trash and history,
so retries and interruptions never duplicate successful writes. The title is
the stored title or session id; the note contains whichever of message count
and last-touched minute the engine supplied, and is absent when neither exists.
The session property is always written. `/clear` predecessors belong to the
head's history and receive no separate nodes.

These are ordinary **filer** writes, named in the Commit panel and ledger;
`auto` still never edits a file. A large initial filing is a burst of independent
writes. Git's cadence may gather it into one large commit or several. Filed
nodes are asleep at boot, including the newest, until something reads or wakes
them. **Move to…** gives one a different home while preserving its property;
trashing it does not cause the filer to recreate it. The Unassigned list and
assignment gesture are retired.

Machine B files B's conversations; A's nodes retain their binding and the
existing missing-session refusal on B. Moving a filed agent into another
agent's subtree makes its subtree part of the outer agent's memory. Both remain
usable.

### Fresh start and past sessions

**Fresh start** is on the agent line. Its tooltip says memory is the subtree and
the transcript becomes history. It opens a new session with the node's engine,
then rewrites the binding and records the replacement link. Its button stays
disabled until the answer arrives, preventing repeated presses from replacing
twice. A refusal leaves the existing conversation, questions and draft intact
and permits retry. A removed node refuses before opening another conversation.

The line above the transcript offers that agent's **past sessions ↑**, with the
available last-touched time and message count. Choosing one opens it in the same
fold or page and puts **current session ↩** on the line to return. Unknown counts
and dates are omitted. The old `sessions (n)` header menu is retired: fresh start
belongs to the agent line and history to the conversation line.

History stays writable, including after a server restart. Opening it changes
neither the node's binding nor its current conversation. Current work continues
and the sidebar reports the current session's standing. A refusal belongs to
the conversation that received the send: opening that past session restores its
draft and **send again**, without putting them in a replacement conversation.
Trashing the node disposes its fold; restoring it permits history and writes
again. `/clear` chains and olai's replacement links keep earlier history reachable
even when an unused intermediate session has no stored transcript to list.
Fresh starts refresh history in every open tab after the binding and link are
written.

### Node agents are live scopes

Filing alone starts no node scope. Reading or a derived wake acquires one;
ongoing work can keep it live after readers leave. Two tabs reading the same
node share its scope without evicting each other. Historical conversations use
the same capacity and idle-reaping policy. Idle sessions can be reaped after
fifteen minutes; working sessions, unanswered questions and live background
work prevent reaping. Capacity pressure can evict an eligible idle scope, not
one still doing work.

Doorbells are chosen per conversation. Kolu and Odu begin off, with a file
picker and clear control. Saved choices can wake an offscreen or reaped agent;
two conversations choosing the same file each receive its notifications.
Plugins without user-controlled wakes retain node-derived recipients.

The subtree is the agent's memory, not a write fence. Its tools read and write
the vault through the existing validator. The remaining reserved-key refusal
prevents agents from rewriting `chat-agent-session` and the host's other
reserved keys. Credentials and write doors belong to the session scope and
leave when it is reaped; expired node credentials remain refused.

Concurrent attachments share a conversation upload directory. Repeated names
receive distinct suffixes across overlapping drops and tabs; writes and cleanup
are serialized within that conversation. Chat owns Alerts and Alert sound
preferences and their storage observers. Controls withdraw with chat and return
with saved choices; the provider survives withdrawal of the shell or preferences
UI. Identity-free alert reveal navigates to and unfolds the first agent in
Needs you order; with none waiting it opens no fold.

### What remains outside this change

Agency, where agents create child agents, and relocation of the scheduler
behind its eventual plugin boundary remain separate work. This change retains
the existing scope lifecycle and tool boundaries.
