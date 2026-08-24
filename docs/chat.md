# The chat agent

Open the panel in the corner and tell the agent what you want. Ask it to check something off and the checkbox in front of you moves — not because the panel echoed anything, but because the write went to disk, through the same validator a load runs, and came back on the same subscription every other change does.

What you type sits on the right, in a tinted bubble. What the agent answers sits on the left, as prose. The two used to share one shape — a faint box on the human's words — and a glance could not tell them apart.

## Which agent

The panel speaks [ACP](https://agentclientprotocol.com), and it talks to whichever agents this machine has. It finds them itself: the pinned Claude Code adapter, which comes with olai — `nix run`, the packaged binary and `just serve` all bake it in, so there is nothing to install and nothing to configure — and an **opencode** on the server's own PATH.

**A conversation is with ONE agent, and you choose it when the chat starts.** Not a setting, and not something a conversation can be moved to afterwards: the way to talk to the other agent is to start a chat with it. What you choose is remembered *for that conversation* and nowhere else, so a new chat asks again — there is no default quietly deciding for you, and no way to find yourself in a conversation with an agent you did not pick.

With only ONE agent installed there is nothing to ask, so nothing is asked. That is the state olai has always been in, and what is new in it is the header: it says who you are talking to, with the agent's own mark beside the name.

The list itself:

- **found once, when the server starts.** An agent installed while olai is running is offered by the next start. What decides whether the panel has an agent at all is not a thing to change under somebody who is reading it.
- `OLAI_ACP_AGENT` points at a different ACP agent for the Claude row — that override has always meant *read this the way you read Claude Code*, and it still does.
- Setting it to the empty string turns chat off — the whole panel, not one row of it: nothing is looked for, and the panel says there is no agent and how to get one. The outlines are served the same either way.
- `OLAI_AGENT_PATH` is where the probes look, and defaults to `PATH`. It is worth knowing about because **olai's PATH is not your shell's**: run as a systemd user service (the home-manager unit) it inherits neither your profile nor your login shell, so an `opencode` you can run in a terminal is not necessarily one this process can see. Set it and it REPLACES the search path.

With no agent at all the panel still draws, and says which agents olai can talk to and where to get one — because a feature that is silently absent cannot be told apart from one that is broken.

The conversation is the agent's own session for that directory: close olai, reopen it, and you are back in it — with the agent that has it, because which agent a conversation is with is written down beside which conversation it is ([below](#which-conversation-you-come-back-to)). A session id means nothing to the other agent, so this is not a nicety: asking the wrong one to open it gets a refusal. And (for the Claude agent) `claude --resume` in a terminal reaches the same conversations.

### What differs between them

Anything an agent does not offer simply is not drawn — except where you would expect the behaviour, and then the absence is stated rather than left to be discovered:

- **opencode has no way of taking a message INTO a turn it is already running.** The box still never locks and nothing is held here; what differs is where the words land. So while an opencode turn is running the composer says the next thing you send will queue behind it, and it is reached when that turn is over. With the Claude agent it lands in the turn ([below](#talking-while-it-works)).
- **opencode's subagents carry no attribution**, so a fan-out is drawn flat — every call in one column — rather than in lanes ([below](#when-the-agent-sends-other-agents)). Nothing here guesses at whose a call was.
- **a tool call's name comes from wherever that agent says it.** Claude Code says it in a field of its own; opencode says it at the head of the call's id (`bash:0`). Either way the row keeps the name it was announced with, and a tool olai cannot name is one you are asked about rather than one that is quietly allowed.

## Which conversation you come back to

**The one you were in.** Olai writes down which conversation the panel holds and opens that one again, so a restart puts you back where you were and nothing else in the directory can take the panel from you: a `claude` you ran in a terminal here, a `/clear` that started a fresh session beside the one it ended, an agent that touched a timestamp for a reason of its own. Before this, the panel came up in whichever session had been written to most recently, which is a different question with the same answer most of the time and somebody else's conversation the rest of it.

If that conversation is GONE — you deleted it, or you have pointed olai at a different agent since — the most recent one in this directory is opened instead, which is what always used to happen. Whichever you get, the header names it.

The note lives with this machine's other state (`~/.local/state/olai/`, or wherever `XDG_STATE_HOME` points), never in the directory being served: it is one conversation id, **the agent that conversation is with**, the model that conversation was on (below), and the path all three belong to — so a directory you serve from two machines remembers a conversation on each. The agent is what makes the rest of it work at all: a session id belongs to one agent, so the boot has to know which one to start before it has one to ask. A note written by an olai that only ever had one agent names none, and is read as being about the one it had — so an upgrade comes back into the conversation it was in rather than into a question. If it cannot be read or written the panel says so in the conversation and carries on — a restart then opens the most recent conversation, which is the old behaviour and a working panel either way.

**chats** lists the stored conversations for this directory — **every installed agent's**, grouped under whose they are — and each row says when it was last touched, to the minute. That is deliberate rather than decorative: `/clear` leaves two sessions sharing one name, and the protocol carries no fact that says which of them replaced the other, so the time is what tells you the row you mean. Picking one loads it — and makes it the conversation you come back to.

**Picking another agent's conversation switches the panel to that agent**, exactly as `+ new` would: a session id belongs to one agent and means nothing to the other, so opening one is a change of both. One agent at a time stays true of the *process* — olai still runs one — and was never true of the history. Before this the list was asked of whichever agent the panel happened to be talking to, so a single opencode chat took every Claude conversation in the directory off the screen, and the way back to one was to start a new Claude chat purely so the list would name them again.

The agent you are talking to is asked every time you open the list, because it is already running and its list is the one most likely to have just changed. The others are *started* to answer, asked, and stopped again, one at a time — so opening the list is not a reason to start three subprocesses at once — and what they said is reused for a few seconds, which is why opening the list twice in a row is instant. **An agent that could not be asked is named in the list, with its reason**, and the others' conversations stay where they are: "there are none" and "we could not find out" are different answers, and so are "this agent is broken" and "there is no list".

With one agent on the machine the list is exactly what it always was — no headings, because a heading naming the only agent there is says what the panel's header already says.

**An answer arrives as it is written.** The agent sends its answer a few characters at a time — hundreds of pieces for a paragraph — and what olai sends the browser is those pieces, not the paragraph so far. That is the difference between a page that costs the connection the answer and one that costs it the answer three hundred times over: before this, reading five paragraphs off a machine across the world moved a megabyte and arrived in lumps, because every token re-sent everything said before it. The text also settles on a clock — a few times a second — rather than on the agent's, so however fast the tokens land, the words come in at a speed a person can read and the machine is not re-laying-out the page per letter.

**A conversation opens on its newest line.** The panel jumps there at once, so a long transcript is not something you have to scroll down. While you read, new text only follows if you were already at the bottom; scroll up and it stays put.

## Who, and which model, the header names

Under the conversation's title, the header names **the agent** — its mark and its name — and then the model. The agent is there because a conversation is bound to one for its life and "who am I talking to" is a question you answer by looking rather than by reading; the model is there because a turn's cost and character depend on it and nothing else on screen says.

An agent olai has no mark for gets a plain one, and its name in full beside it. It never borrows another agent's mark.

It names the model the agent is **running**, which is not always the one the session was started on: `/model` is handled inside the CLI the adapter wraps, so the adapter never learns of it and its own picker goes on reporting the starting model for the life of the session. What the header follows instead is the CLI's own message, forwarded because olai asks for it whenever it opens a conversation — a new one and a stored one alike.

Two consequences, both of them the adapter's shape rather than a choice:

- **it changes one turn late.** That message is emitted as a turn STARTS, so the turn that ran `/model` still announces the model it began on, and the new one is first heard of when you send the next thing. Nothing else on the wire carries it — the only other trace of the change in that turn is the agent saying so in prose, and reading a sentence is not something olai will do.
- **it is named the way the agent names it.** The running model arrives as an API id (`claude-sonnet-5`) while the picker offers aliases (`sonnet`), so the two are matched up and the header says *Sonnet*. A model the picker does not offer at all is shown as the id it came as, which is truthful about a name nobody gave — never rounded to whichever row looks closest.

**A raw id in that line is a refusal, not a failure**, and the commonest reason for one is worth knowing: the running model never states its **context window**. The CLI reports `claude-opus-5` whether the session has 200k or 1M, so when the only Opus the picker offers is the 1M one, that row is not allowed to answer — naming a window five times the real one, in the line you would read to decide whether to `/compact`, is worse than naming nothing. You get `claude-opus-5`, and what it does not say, it does not say.

## The model you switched to survives a restart

**Switch the chat with `/model` and it stays switched**, across an olai restart and a new deploy — the conversation comes back on the model you put it on, and the header names it before you type anything.

That is a fix rather than a given, and what it is a fix for is worth knowing about because it happens at the agent's end, not olai's. The agent resolves a session's model in a fixed order — the `ANTHROPIC_MODEL` variable, then `settings.json`, then the model the conversation was actually running — and on *resuming* a conversation it deliberately re-asserts the first two over the third. So a machine whose settings pin `"model": "sonnet"` puts every restored conversation back on Sonnet, however it ended. A `/model` lives only in the conversation itself, which is the half that loses. The chat was on Fable on Friday and on Sonnet on Monday, and nothing said why.

So olai writes down which model this conversation is running, and after a restore, if the conversation has come up on a different one, it says so back — through the same model setting the agent's own picker is. What you get is the model you chose; what a *new* conversation gets is still the machine's default, which is what a default is for.

**And a `/model` made in a conversation you came back to is heard at all**, which is the quieter half of the same fix: the CLI's message is forwarded because olai asks for it when it opens a session, and it was only asking when it *started* one. Every conversation after a restart is a restored one, so the header had gone deaf in exactly the conversations you spend your time in — it went on naming the model the session came up on, however many times you switched.

Two things follow, and both are the honest shape of it:

- **only a switch you made while olai was watching is remembered.** A conversation that never left the machine's default comes back on the machine's default — olai has nothing of its own to say about it, and pinning a conversation to whatever the default resolved to that day would be inventing a choice nobody made. One consequence is worth knowing after an upgrade: a `/model` from before this existed is not a switch olai saw, so the first restart still opens on the default and switching again is what makes it stick.
- **a switch made somewhere else, while olai was not running, loses.** The conversation is reachable from a terminal (`claude --resume`), and a `/model` typed there lands in the same place a static pin does, as far as anything on the wire can tell: the restored conversation simply comes up on a model olai's note disagrees with. Olai puts its own note back. Between a panel that loses the choice made *in* it every single restart and one that can lose a choice made elsewhere while it was off, this is the better of the two.

If the model cannot be put back — an agent that will not take the setting — the conversation opens anyway, on whatever the agent chose, and the panel says so in a row rather than in a log. Nothing is retried behind your back; the next restart tries again.

## How full the context is

Beside the model, the header says how much room is left: **`22k/1M`** — tokens in the conversation, and how many fit. It is the other half of the model's own sentence, and it answers the question the panel used to have no answer to at all: *is it time to `/compact`?* Before this, the way you found out was by watching the agent start forgetting.

It comes from the agent, not from a count kept here — ACP carries it (`usage_update`), and olai draws what it is told. Several arrive per turn and the newest wins, so the number moves as a turn runs rather than only at the end.

A **fraction rather than a percentage**, because the window is not a constant: 200k and 1M are both ordinary, and a session moves between them when the model does. "2%" would read identically in both and mean quite different amounts of work left, so both numbers are shown and the division is yours.

Two things follow from it being the agent's number:

- **the window itself can move under a conversation.** The agent seeds it from what it last knew for the model and corrects it when a turn ends, so the first turn after a `/model` can report the old window and then the true one. That is the agent revising something it told us, and the header follows it.
- **an agent that reports nothing gets no line.** The header simply says nothing about room, which is different from a conversation that has spent nothing — that one says `0/200k`. You will see this twice: before the first turn of a fresh conversation, and after **opening a stored one**, which replays its messages without a usage report. In both cases the next turn fills it in.

What a session has **cost** is on the wire too, and is deliberately not drawn: it is a different question, asked at a different moment, and a second number there would buy nothing for the one this line exists to answer.

## Talking while it works

**The box never locks, and what you type while a turn is running goes to the agent immediately.** It does not wait for the turn to finish — with an agent that can take one, it lands *in* the turn, so an agent halfway through the wrong thing can be redirected while it is still doing it. "not that file, the other one" is worth saying at the moment you notice, and that moment is almost never the moment the agent stops.

**Not every agent can take one, and the composer says which you have.** opencode has no such method: what you send mid-turn is an ordinary message it QUEUES behind the running turn and reaches when that turn is over. Nothing is held here either way — the words go out when you send them, and they are on screen from the moment you do — so what the line under the box is telling you is what saying it *now* buys you. Two panels that looked identical and behaved differently is the thing it exists to stop.

**While anything is happening, a line under the transcript says so** — *opencode is working…*, *starting opencode…*, or *waiting on your answer* when the turn has stopped on a form. It sits between the last row and the box, which is where you are looking after you press enter, and it is gone the instant the panel is idle. The header says the same fact up in the chrome; this is the copy you can see without moving your eyes. (The box's own border turning is focus styling — it is the border a click into the box draws — and it never meant anything else.)

The button says **send** the whole time, because that is what it does the whole time. Cancel sits beside it rather than replacing it: sending and stopping are two things you can want at the same moment, and while a turn runs they are usually the two you are choosing between.

**Cancel stops the agent, and only that.** There is nothing else for it to do — every message you have typed already went. This is a change worth knowing about if you used olai before: a message sent mid-turn used to be held until the turn ended, and cancelling threw away everything that was waiting. Those words were nowhere else. They are not held anywhere now, so there is nothing to throw away.

**If a message cannot be delivered, it stays on screen.** It keeps its own bubble, exactly as you typed it, outlined and marked — and the mark says which of two things happened, because they are not the same thing and they do not deserve the same button.

***not sent*, with send again underneath.** The agent said no: it cannot take a message mid-turn at all (the agent olai ships with can), it was not there to be asked, it **refused the turn itself**, or **you cancelled while your message was still on its way** — a fair thing to do, and the cancel wins rather than your message quietly starting the turn back up. Nothing took the message in any of those, so pressing the button sends it for the first time. Nothing retries on its own; whether to try again is yours.

**And a conversation the agent will not open is not a dead agent either.** Starting one, or re-opening a stored one, is a request like any other too — so an agent can say no to it: a directory it will not work in, a conversation it no longer has, a mode it cannot resume from. The panel then says *that*, in the agent's own words, where the conversation would be: the header goes on naming the model, because the agent answered and is therefore running; there is no box, because there is nothing to send to; and there is a **try again**, which asks for the same thing that was refused rather than for whatever olai would have picked. Before this the panel said *not running* about a live agent and left an empty transcript with a working box under it. Press *try again* twice and the second press is told there is nothing waiting — the first took it — because two retries of a refused *new conversation* would be a second fresh one wiping the first. That explanation goes away with the agent: a refusal is about one that is running, so a process that dies takes it with it and you are back to the rows it left.

**A message typed while a conversation is opening waits for it.** Opening one takes real time — a freshly picked agent is a subprocess starting, a handshake, and then a whole conversation replayed before it answers — and the box is not locked while it does, so the next thing you type lands in the gap. It goes into the conversation being opened, once it is: nothing is refused, nothing is lost, and nothing is sent twice. Before this it started a second open of its own, against the first, and the message died with it; and a message sent in the seconds after picking an agent lost its own bubble, because the replay of the conversation it was going into empties the transcript it had just been written to. What you see instead is the panel saying it is **starting** — from the moment you click, not from whenever the server's first frame arrives — and your message appearing when there is a conversation for it to appear in.

**A turn the agent refused is a turn that ended, not an agent that has gone.** Starting a turn is a request like any other, and an agent can answer one with an error rather than with a result — it is in a mode it cannot work from, it has lost track of the conversation, it could not reach the model. What you get is the reason, in the conversation, and a panel that is still *ready*: the agent is running, you are still in the conversation you were in, and the next thing you send goes to it. Olai used to read that as the agent having died, and then said *not running* about a process that was running until some later turn happened to succeed.

***no answer — it may not have arrived*, with no button at all.** Your message went out and nothing came back — the agent went quiet, or died with the message on the wire. An agent that took it and *then* went silent looks exactly like one that never took it, so olai will not tell you which, and will not offer you a *send again* that might be a second copy. The words stay in the bubble where you typed them; what to do next is yours, and a look at what the agent did afterwards is usually the answer. The reason also goes into the conversation as a line of its own, so it is still there after the banner has cleared.

**A turn that ends having said nothing is not a turn that went well.** The agent takes the message, answers that the turn is over, and produces no prose, no tool call and no question — so the panel used to draw exactly that: nothing, under the message you just sent, and back to *ready*. It is what an agent that cannot reach a model looks like from here, and it is quiet on purpose at the other end — opencode with a provider key it cannot resolve sends one zero-token usage report and then a **successful** end-of-turn, with no error anywhere on the wire. Olai now says it: a notice in the conversation naming the agent that was silent and telling you to check that it is signed in and that its provider key is in the environment olai itself runs in, and the banner stays up rather than clearing on the way to idle. The commonest cause on a deployed instance is the environment — an agent olai spawns inherits *olai's* environment, not your shell's ([running.md](running.md)).

A turn you **cancelled** before it said anything is not this: it already has a notice of its own, and blaming the agent for stopping when told to would be the panel arguing with you.

## What it can touch

**Olai hands the agent no filesystem.** What olai itself gives it is a closed list of tools that name a NODE, a whole DOCUMENT or the whole TRASH, and nothing smaller than any of them — search, read a subtree, create an outline, add, mark, retitle, note, schedule, move, trash, place a mirror, retire one, wire what a node waits on, and empty the trash, plus the two that do several of those as ONE write (`update` for several fields of one node, `apply` for a list of ops over many) — so the edits it can ask *olai* for are the edits the format can be, and a malformed outline is not something that path can produce. The documents beside the outlines have four verbs of their own — `list_documents` and `read_document` to find one and read it whole, `create_document` and `write_document` to mint one and replace its text — and they are still not file access: the listing is this directory's own set rather than a disk, and neither end of a document call names an offset or a range, because a `.md` is one text. The one verb on that list that DELETES is `empty_trash`, which names `_olai/Trash.olai` and empties it whole — every record in the trash or none, nothing put back by anything in olai, and refused while a live row still points into it. When a write is refused, the validator's own rows come back, pinned to the lines they are about; when a write lands but is worth a second look, the answer says so — advice about something that happened, never a refusal.

**What the agent brings with it is its own.** The default agent is a coding assistant, and a coding assistant edits files: ask it to fix a typo in a `.md` and it will, with its own tools, on its own authority — the same authority it has in a terminal, over the directory it was started in. Olai neither grants that nor pretends it away; what it does is SHOW it, which is the section below. The one thing worth knowing is that an agent editing a `.olai` by hand is writing the format without the validator in front of it — the outlines are plain text and nothing stops that — so if you want an outline changed, ask for the change rather than for the edit, and it goes through the tools.

It can ask you back: when it needs to know which of two things you meant, the question arrives as a form in the conversation, and nothing times out. Dismissing one is an answer too — the agent is told you would not say, never handed a choice you did not make.

## Asking about one node

A row's `•••` menu offers **Ask agent**, and choosing it opens the panel with that node in the box — a chip above what you type, which you can take off again before you send. The turn is then about THAT node rather than about whatever your sentence re-describes: "why is this waiting?" needs no title in it, and two nodes with the same title are not a thing you have to disambiguate in prose.

What the agent is handed is the node's **id**, with its title, its `file:line` and the titles it hangs under, as one line under your message — the same arrangement an attached file gets, and for the same reason: the id is the handle every one of olai's tools takes, so the agent can read the node, mark it, note it or move it through the same gate as always. What it is NOT handed is a copy of the node's contents: a subtree pasted into a prompt stops being true the moment anything writes, and the agent has `read_node` for the live one.

The chip says the title, but the title is not what is sent. Rename the node between arming and sending and the agent gets the name it has now; **delete** it and the send is refused, in the same words a tool call gets for an id nothing declares — because a question about a node is not one to ask without it.

**Archiving it is not that.** What was put away keeps its id and stays askable — the Trash's own rows offer **Ask agent** like any other, and the `@` list will complete one for a query that says `is:trashed` — because "why did we put this away?" is a fair question and refusing it would be olai deciding which of your own rows you may ask about. What the agent is told is that it *was* put away, as a word on the same line (`; archived`): no tool refuses a write into an archive, so a row arriving as ordinary work would be ticked off as ordinary work.

## Naming a file, or a node

**Type `@` and the directory comes up**, filtered as you type — its **files** first and its **nodes** under them, in one list of eight, four rows kept for each kind and either taking the other's unused ones. (That reserve is why a file you were expecting can be missing: nine matching filenames cannot push every node off the list, and a vault full of matching rows cannot bury the file you type every day.) Taking a file writes the whole path into your sentence (`read @notes/cabinets.md `); taking a node writes its id (`look at @hinges `) and puts the node on the message, as a chip above the box. It is the gesture a terminal agent already has, and it is here for the same reason — a vault spells its folders however it spells them, and a path half-remembered reaches the agent as a file that is not there. A row half-remembered was worse: there was no way to name one at all.

What the file half offers is **the files this directory serves** — every outline, every document, every saved page, which is the set the sidebar draws — because they are already on this tab's subscription. Nothing is walked to answer that half and nothing is asked of the server, so a vault with a thousand files costs the same as one with ten. The NODE half is the other way round now: it is the server's own search ([search.md](search.md)), so it arrives a beat after the files rather than with them — which is why each half keeps four rows whatever the other found, and why a list you are already walking does not reshuffle when the nodes land. The archives are in it, unlike in the sidebar, which hides them behind Trash: what a message may NAME is a file the agent will open, an archive is a file, and "what did we put away last month" is a fair thing to ask.

A file row reads the file's **name**, with its folder beside it, and writes the **path**: a `Daily/` vault is a column of identical dates otherwise. `@notes/` works too — a folder is the start of a path like any other prefix.

**The node half is the search you already know** — literally the same one, asked of the server, so `@cab` here selects what `cab` selects in the filter bar, in the `⌘K` palette and in an agent's `search_nodes` — title, id, tag and note, ranked the same way, with a finished node losing ties ([search.md](search.md)). Whatever fits in one word works: `@is:blocked` names something that is waiting, `@#home` names by tag, `@date:today` names something scheduled. What needs a space does not — a quoted phrase, an `OR` — because the word ends where you would expect a word to end, and a completion that swallowed the rest of your sentence on the chance the next word was for it would be worse than one you have to finish elsewhere. `@` **names** one node; the palette **searches**.

That has one honest consequence: an operator with no word in it scores every match the same, so all that orders `@is:blocked` is the rule that puts finished work last, and then the directory's own order — not the eight most relevant. There is nothing to be relevant to.

And one more, from the day the node half became a question: **fewer than three characters offers no nodes** — the floor every box onto this search keeps, because two characters match half an outline by substring. `@ca` offers the files; `@cab` offers both.

**What was put away is not offered, and `@is:trashed` is how you ask** — the ruling that what is archived is drawn on the Trash and nowhere else, arriving here without being restated ([search.md](search.md)'s one-page rule). It is the opposite of the file half of the very same list, deliberately: a path names bytes an agent will read, where a node names a row of a reading. The third list over this set, the `#tag` completion in a row's editor, goes the archived-out way for its own reason — it ranks the vocabulary of the page you are looking at.

A node row reads its **title**, and beside it the **id it writes** and where it sits — the nearest ancestor first, or the file for a node at the top of one, with the `·` belonging to that trail and to nothing else. Two rows with one title are what that is for; a vault gets a pair by copy-paste, and picking blind between them is the thing this feature exists to stop. A row that is there for something in the node's **note** says so, because otherwise it is a row whose every word is unfamiliar.

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

While the list is up the keys are the list's: ↑/↓ walk it — through both blocks, one cursor — Enter or Tab take the row, Escape closes it. A click does the same for a hand already on the mouse. It is the same box the `/` commands use, because it is the same gesture.

**And Enter takes a row of the list you are looking at.** The node half is asked of the server, so it settles for a fifth of a second before it asks and those rows hold still until the next ones land. Enter inside that gap writes nothing rather than putting the word before last's node into your sentence and arming it; the rows catch up a moment later, and the same key takes the one you meant ([editing.md](editing.md) says it where the other lists in this app say it). The FILE rows are matched in your own tab, so they are never behind anything: `@cab` and Enter writes a path at once, as it always has. And a click is never held back at either half — your hand is on the row you can see.

## Pointing back at a node

Ids in the panel are pressable, and pressing one shows you that node: the row scrolls into view and says it is the one being talked about. If it is not on the page you are reading — another outline, a branch you have collapsed — you go to its own page instead.

Three things in the conversation are ids, and none of them is a syntax anybody had to invent:

- the **chips on your own message**, which are the nodes you asked about;
- **what a write changed** — every edit the agent makes through olai's tools draws a line naming the node, and that name is the node;
- **an id the agent wrote in backticks**, which is how it spells one anyway, because that is how every one of these tools describes its own arguments. A backticked word becomes pressable exactly when the set declares it: `notes.md` and `--commit=off` stay what they are. An id that names a MIRROR shows you the node it is a placement of — the same place a `see` to that mirror lands, and the only one there is: a mirror is drawn wherever its target is, and it is the target a row stands for.

**Which of them are ids is asked of the server**, once per message — the browser used to answer it out of its own copy of the whole directory, and that copy is what it is giving up ([brainstorming/vault-in-browser.md](brainstorming/vault-in-browser.md)). Two things follow, and both are visible:

- a backtick is **plain until the answer lands**, a beat after the words. It is never marked on a guess and unmarked afterwards: a reference that vanishes under your cursor is worse than one that arrives a millisecond late.
- the answer is **what the set said when the message was drawn**. A message is a record of something that happened; a node named an hour ago and put away since keeps its mark in that paragraph, and pressing it takes you to its page, which says where it now is. The next message that names it asks again.

If the lookup itself fails, the panel says so at the end of the conversation — one line, because one question carries every message's ids. The words are all still there; what is missing is which of them can be pressed.

**A link the agent writes is a link**, and it behaves like every other link in this app: a path to a document (`notes/plan.md`) or an address of olai's own (`/house.olai`, `/#order`, `/today`) opens in the pane you were last reading, in place, with the conversation still beside it — and Alt+click opens it in a pane to the right. A `https://` one opens in a new tab, so a click can never throw the app away.

## What it shows when it changes something

A tool call is one folded line, and what the call CHANGED is not folded away — the arguments are what was asked for, and this is what happened to your files. There are two kinds of change and the panel draws them differently, because they are different things.

**The name on that line is the one the call was announced with**, and it stays put for the life of the call. An agent may rewrite a call's title as it goes — the tool's name while it starts, a sentence about what it is doing while it runs, something else again when it fails — and a row that followed along would rename itself two or three times while you were reading it, taking the name of any lane hanging off it with it. What the row says instead is what the call was called when it appeared. What it was asked, and what came back, are in the fold, where a call's detail always is.

**A file the agent rewrote** — a `.md`, a source file, anything that is not a node — shows its diff, right there in the conversation: the path, how many lines came and went, and the change itself, with the unchanged stretches between two edits collapsed so what you read first is what moved. A long line wraps inside the change — the line number and the +/- stay in their column — so the conversation never grows a horizontal scrollbar. It is TRIMMED to a few lines, and a click opens the rest where it stands. That is the one thing the transcript is for here: an edit like this appears in no outline, so before it was drawn, the only way to see what an agent had done to a file was a terminal.

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

**It shows what the wire calls running**, which is not quite the same as what is running, and the difference is worth knowing: a call the agent finishes at launch and lets carry on in the background arrives here already complete, so it has no duration and should not be given one. Guessing at the far side of somebody else's process is not something this panel will do.

**And it stops when the call's TURN does**, which is a stronger promise than it sounds. A status is sticky, and the rows a dead or abandoned call leaves are deliberately still on screen to read — so a call nothing ever reported back on says *pending* for as long as the panel is open, which is the honest record of what happened. A clock asked of that alone would count up all afternoon under a process that stopped at lunchtime, which is the same lie the rail under a spawn is careful not to tell, except that a wrong word stays the same size and a wrong number grows.

*Whether this conversation is busy* is the near-miss, and it is worth saying why it is not the question. Ask again after an agent has died — the rows are still there, that is the point of leaving them — and the new turn makes the panel busy again, so every call the last turn walked away from would light back up at once, each with a clock counting from when it first started. So olai marks what each turn leaves behind, on the call, and a later turn cannot take that back.

## When the agent sends other agents

An agent can spawn agents of its own — one to search, one to read, several at once — and their work comes back to olai on the same wire as everything else the turn does. So it is drawn as what it is: a call a subagent made sits **indented behind a rail**, under the call that spawned it, and the ordinary column is the main agent's own.

Where a stretch of one agent's work begins, the lane says whose it is — the description the agent was sent with, *explore the outline*, *review the notes* — and then stops repeating itself: a subagent that reads ten files gets one name and ten rows, not ten names. That name comes back whenever the thread is picked up again, which is what makes two agents running at once readable: their calls interleave, and each stretch says which of them it was.

None of this is anything you turn on, and there is nothing to fold: a turn that spawned nobody looks exactly as it always did. What it replaces is a panel where three agents grepping at once and one agent grepping three times were the same five lines — which was the only thing in this conversation that was not true.

### An agent that has not reported back yet

**A rail drops out of the call that sent an agent out, at the moment it sends one**, and it says the agent is working — which is already true before it has done anything you can see:

```
· read every note                        ↳ Explore
│ ● working…
```

That is the fix for the thing everything above missed. A lane is drawn out of work a subagent has ALREADY done, and a subagent's first act is to read its instructions, which produces nothing to draw — so for the whole of the stretch you actually watch a fan-out through, the panel had a pending dot with an ordinary title on it and nothing anywhere saying an agent had been started. Three agents out looked exactly like one slow `Read`.

Three things are on that row and every one of them comes off the wire:

- **who it is** — the kind of agent, on the right of the row, in the words of whoever defined it: *Explore*, *general-purpose*, a name out of your own agents. A spawn that named no kind says the bare word **agent**, which is the honest thing to say about an agent nobody labelled — never rounded to whichever kind looks closest.
- **what it was asked** — the row's own title, which is the short description the call was made with. The whole prompt is one click away, in the fold, where a call's arguments always are.
- **that it is running** — the rail, which says *working…* and **goes away the moment the call stops**. One word, and it was briefly two: a *starting…* that became *working…* at the agent's first heartbeat. That read as more precise and was less true — every tool call is announced *pending* whether or not it has got going, the subagent is dispatched at once, and a heartbeat can be half a minute away, so a subagent whose work was already listed in the lane below went on being described as starting while you watched it. A face that outlived the agent would say a fan-out was running after the turn was over, which is the same lie in the other direction — so it also goes when the CONVERSATION stops, which is what covers the way this actually goes wrong: an agent that died between sending somebody out and reporting on it leaves a row that will never say it finished, and the rows a dead agent left are deliberately still on screen to read.

Then the calls arrive in the lane that is already open under it, and when the agent reports back the row completes and its answer is in the fold. Nothing about the rest of the drawing changes — the same rail, the same names, in the same places.

### When it is a subagent that asks

A spawned agent can stop and ask — permission for a tool nothing recognises, or a question with options to pick from — and the form lands **in that agent's lane**, indented behind the same rail its calls are, with the lane naming who is asking:

```
· explore the outline                    ↳ Explore
│ ↳ explore the outline
│ ┌ Allow `rg --files`?
│ │  [ Allow Once ]  [ Deny ]
│ grep for worktops
```

That name is drawn on a form wherever it sits, which is the one place the *once per stretch* rule above does not apply. The reason is what a form is: the one row here where being wrong about who is speaking changes what you press. And you rarely meet it by reading down to it — a blocked question is announced in the composer, in the header and on the app's agent toggle (the thumb strip, on a phone), so you come looking for a form that may be anywhere, including scrolled off the top of a long turn with nothing above it you have read.

Before this, the form was drawn in the ordinary column and read as the agent you are talking to. The second half was louder: a row in nobody's lane, landing between two of one subagent's calls, **ends the stretch** — so the lane opened again and introduced itself a second time under the form, and one agent's run read as two.

**What is deliberately not drawn is the subagent's own prose.** The agent olai ships with does not send it: a spawned agent's text and thinking are stripped from the feed unless a client asks for a nested transcript, and olai does not ask. So a running subagent is its calls and its status here, and the one place its own words appear is the report it hands back at the end. That is a floor rather than a preference — but it also means the main agent's voice in this panel is only ever the main agent's, which is worth having.

## When it is waiting on you

A turn that stops on a question does not time out and does not carry on. It hangs — for as long as it takes you to notice — so the panel's job is to make sure you do.

**If the conversation is in front of you, the form appearing is the whole of it.** It arrives where you are already looking, the composer says the agent is waiting on you, and nothing rings. A notification about something already on your screen is nagging, and the surest way to make somebody switch these off.

That counts ANOTHER TAB of the same olai, too. Two tabs are two documents and one person: the one you are reading says so to the others, so the tab behind it does not chime about a form you are looking at. A different olai — another directory, another address — is not caught by it, and goes on telling you.

**If it is not** — the window behind an editor, the panel put away, olai on another desktop — three things happen at once:

- **one short chime.** Two notes, a third of a second.
- **a system notification**, naming the conversation and the first line of what the agent wants, so you can decide whether to get up without getting up. Clicking it brings olai forward, opens the panel and puts the question on screen. With the panel already open when the question landed, the notification quotes it; with the panel shut, olai has not been reading the conversation and says so plainly instead of quoting something it read ten minutes ago.
- **a mark on the app's icon** — the number waiting, on an installed olai's dock or home-screen icon; a dot on the tab's title and favicon in an ordinary browser tab. The number is QUESTIONS and not chats: the panel holds one conversation, so a **2** means that conversation has asked you two things, never that two conversations want you. **It stays until you look**, not until you dismiss the notification: swiping a banner away does not answer a question, and the mark is the thing that is still true afterwards.

**A turn merely FINISHING is silent, on purpose.** An agent that has finished will still have finished in five minutes; a chime for every turn is a chime people switch off, and it would take the one that matters with it.

Two rows in **preferences** decide all of this — **Alerts**, and **Alert sound** beneath it — and both start ON. They are two rows rather than one because they are two questions: turning the chime off in a quiet office should not also cost you the notification. Turning Alerts off silences all three, and puts the icon back.

The notification is the one part that needs the browser's permission. olai asks for it the first time it actually has something to tell you, which is when the question in the prompt is about something real; if your browser only allows that prompt after a click, the Alerts row carries an **Allow notifications** button. Refuse it and the chime and the icon mark go on working — neither needs permission.

**The honest limit: olai has to be running.** The alerts ride the same live connection everything else in this app does, so they reach you with the window in the background, on another desktop, or behind everything — but a completely closed olai is not listening, and nothing wakes it. There is no push server, and adding one is its own decision rather than a detail of this.

## Attachments

You can paste a file into the box — a screenshot, a photo of a whiteboard — or drag one onto the panel, or pick one with the **+** button, which is the way in on a phone. All three take the same kinds:

- **pictures**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico`
- **documents**: `.pdf`, `.txt`, `.md`, `.csv`, `.json`

The bytes go into a temporary directory belonging to that conversation, never under the directory being served, and the agent is handed the PATH: it reads the file itself, so nothing rides the prompt into the stored session, and nothing attached here can end up committed with your outlines. The files go away when you start a new conversation or stop the server.

A picture shows itself in the strip above the box. Anything else shows its name and how big it is, because a PDF has no thumbnail worth drawing and a broken image icon is a lie about a file that arrived perfectly.

Dropping is aimed at the whole panel rather than at the box: while you are dragging over it the panel says so, and what lights up is what will take the file. Several files in one drop attach in the order you dropped them, and they reach the agent in that order. Anything olai will not take is named where it was dropped — an SVG (a document that can script, whatever the drag calls it), a `.zip`, a file over the 50 MB cap — so a drop never disappears quietly, and whatever it can take in the same drop still attaches.

## kolu

If the machine is running [kolu](https://kolu.dev) — terminals for coding agents — the panel's agent gets kolu's terminals too, and there is nothing to set up: every new conversation looks for the padi daemon this host answers on, and hands the session `kolu mcp` when one is there. It is looked for rather than assumed: olai starts the `kolu` it found and asks it to read something only a running daemon can answer, because a `kolu` on a PATH is not always the one this host is running, and a wrong build will start perfectly well and know nothing.

## Which tool servers a conversation has

**The panel answers it, so you never have to ask the model.** Under the header, where the session title and the model already are, is the list of MCP servers this conversation was handed:

```
olai ✓  kolu ✓  · plus the agent's own
```

Ask an agent which MCP servers it has and you are asking the worst-informed thing in the room: nothing in a conversation's context is a record of what it was handed. The incident that filed this feature is exactly that — an agent asked the question listed two servers, left out kolu, and then used kolu's tools perfectly a moment later.

**A tick means the agent said so.** It is the one mark olai will not infer. A name with no tick means olai handed the server over and nothing has said what became of it — which is every row before the first turn (the agent reports its servers as a turn starts, so a brand-new conversation has been handed them and nothing more) and every row for the whole life of a conversation with an agent that does not report per server at all. ACP itself never does: `session/new` answers with a session id and not one word per server. The Claude Code adapter volunteers it on its own channel; opencode does not, and its conversations draw names without ticks rather than ticks nobody asserted.

**`plus the agent's own` is not a hedge for the sake of one.** Olai lists what olai handed over. Whatever your agent is configured with of its own — a server in your `~/.claude.json` or `opencode.json` — is set up somewhere olai never looks, and olai will not draw a row it has no way to keep honest. So the list is exactly as complete as it says it is.

**A server the agent could not attach says so, in the agent's own word.** `needs-auth` and `failed` are different problems with different fixes, so the panel repeats the word rather than flattening it into "did not attach".

## When a tool server does not arrive

**A server that fails to attach is on screen, not in a log.** If there is a `kolu` on this host's PATH and it would not answer, the panel says so under the roster — the name, and the reason the probe or the server itself gave:

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
