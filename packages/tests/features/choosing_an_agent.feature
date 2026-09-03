Feature: Choosing an agent
  The panel talks to one agent, and which one is a question with an answer per
  conversation. Olai looks for the agents it knows — the ACP adapter it ships
  with, and an `opencode` on its own search path — and what it finds is what you
  can choose between. A conversation is bound to the agent it was created with
  for its life, and the note this directory keeps remembers which, so reopening
  one talks to the agent that has it.

  The scenarios tagged `@opencode` are the ones whose server FINDS an opencode:
  a scripted one shaped the way the real one is on the wire
  (`agent/opencode/opencode`, captured against 1.17.9). The `@pi` ones are the
  same arrangement for pi: a scripted `pi-acp` beside a stub `pi`
  (`agent/pi/pi-acp`, captured against pi-acp 0.0.33), and the row is the PAIR
  the production roster makes — adapter from the variable, agent from the
  probe. Everything else in this suite runs with an empty agent search path
  and a roster of one, which is what every olai in the world is running
  today — and which is why the picker does not turn up in front of scenarios
  that are not about it.

  Background:
    Given I open the app
    # Whatever the roster, the write being watched is a DONE mark, and the
    # row has to stay on the page to be seen wearing it (`the_agent.feature`'s
    # Background says it at length).
    And I show the done nodes
    And I mark the page
    And the agent panel is open

  @opencode @scratch:chat
  Scenario: A new chat asks which agent
    # The ruling: every new chat asks, and no default is remembered across
    # conversations. So a panel with two agents and no conversation to come
    # back to holds nothing at all until somebody answers — there is no box to
    # type into, because there is nobody to send to.
    Then the panel asks which agent
    And the picker offers the agent "claude"
    And the picker offers the agent "opencode"
    And there is nothing to type into

  @opencode @agent-stored @scratch:chat
  Scenario: `+ new` adds nothing to a question the panel is already asking
    # The press has nothing to add: the question is up, and the answer to it
    # opens a conversation. What it must not do is take the question OVER —
    # answering the boot's question with the wrong verb mints a fresh
    # conversation where the panel was about to come back to the one this
    # directory was in, and the two are told apart only by what happens next.
    Then the panel asks which agent
    When I start a new conversation
    Then the panel asks which agent
    When I choose the agent "opencode"
    # ADOPTED, not minted: this agent has a stored conversation for this
    # directory, and the boot's own question is what was answered.
    Then the chat eventually shows "opencode remembers this conversation"

  @opencode @scratch:chat
  Scenario: An agent this machine no longer has is not a conversation to wedge on
    # The note names an agent, and an agent can be uninstalled between one serve
    # and the next. That is not a refusal and not a wedge: the id means nothing
    # to anybody left, so nothing is remembered — and here the one agent left is
    # not a choice, so the panel binds it and says which it is.
    When I choose the agent "opencode"
    And I ask the agent "hello"
    Then the chat eventually shows "opencode says: hello"
    When opencode is no longer installed
    And the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the panel does not ask which agent
    And the header names the agent "claude"
    And the chat input takes typing

  @opencode @scratch:chat
  Scenario: The header says who the conversation is with
    # The other half of the ruling: the header shows the agent's icon and name
    # beside the model. A mark as well as a name because the question is one a
    # person answers by looking rather than by reading.
    When I choose the agent "opencode"
    Then the header names the agent "opencode"
    And the header draws that agent's own mark
    And the chat input takes typing

  @scratch:chat
  Scenario: One installed agent is not a choice
    # Every olai before this one. Asking a one-row question is friction with no
    # answer behind it — what a person gets instead is the header saying who
    # they are talking to, which is the part they did not have.
    Then the panel does not ask which agent
    And the header names the agent "claude"

  @opencode @scratch:chat
  Scenario: A turn with opencode, from the box to the answer
    When I choose the agent "opencode"
    And I ask the agent "bash"
    Then the chat eventually shows "ran it"
    And the page has not reloaded
    And there should be no page errors

  @opencode @scratch:chat
  Scenario: A call is named from its id, and keeps that name while the title moves
    # Opencode sends no `_meta` at all, so the only place a tool's programmatic
    # name is said is the head of the call id (`bash:0`). The `title` is not it:
    # this agent rewrites it under the call, the way the real one does, and a
    # panel that read the title would rename the row while somebody was looking
    # at it.
    When I choose the agent "opencode"
    And I ask the agent "bash"
    Then the chat shows a tool call named "bash"
    And the chat shows a completed tool call

  @opencode @scratch:chat
  Scenario: A write through opencode's own tool naming reaches the outline
    # Opencode names an MCP server's tools `<server>_<tool>`, not
    # `mcp__server__tool`. The panel has to recognise `olai_set_done` as one of
    # the tools it handed this session — so no permission form is drawn, the
    # write goes through the real ops layer, and the checkbox in front of a
    # person moves.
    When I choose the agent "opencode"
    And I ask the agent "done order"
    Then the chat eventually shows "marked order done"
    And node "order" is done
    And the chat shows no question
    And the page has not reloaded

  @opencode @scratch:chat
  Scenario: One of olai's own is answered without anybody being asked
    # The same rule at the other door: a permission REQUEST for one of ours is
    # answered here and now — and by the option's own kind rather than by its
    # place in the list, because opencode's options lead with an allow where the
    # other agent's lead with the refusal.
    When I choose the agent "opencode"
    And I ask the agent "permit"
    Then the chat eventually shows "allow_once"
    And the chat shows no question

  @opencode @scratch:chat
  Scenario: A tool nothing named is never approved by failing to recognise it
    # The fail-safe rule, at the one place it can be walked end to end. The call
    # id carries no name, so nothing can say which tool this is — and a tool
    # olai cannot name is one a PERSON is asked about. A rule that widened here
    # would approve somebody's permissions on their behalf.
    When I choose the agent "opencode"
    And I ask the agent "nameless"
    Then the chat shows a question

  @opencode @scratch:chat
  Scenario: The composer says what a mid-turn message will do
    # What you type while a turn runs is an ordinary prompt opencode queues
    # behind that turn — which since `compact-lost-to-steer` is what a mid-turn
    # message is on EVERY agent olai talks to. This leg was the odd one out and
    # is the one the other converged on, so the line is a promise now rather
    # than a warning about a degradation.
    #
    # And opencode still has no steering method, so it is the leg with one
    # gesture where the other has two: nothing here offers an interruption.
    When I choose the agent "opencode"
    And I ask the agent "slow"
    Then the composer says a message would queue
    And the composer offers no interruption
    When the agent is released
    Then the agent is idle
    And the composer says nothing about queueing

  @opencode @scratch:chat
  Scenario: A message sent mid-turn goes out at once and is reached in its turn
    # What the composer's line is ABOUT, walked end to end. Nothing is held on
    # this side — the words are on screen the moment they are sent — and the
    # agent reaches them when the turn they were sent into is over. Until then
    # the panel is working, because it is: two turns this server owns, and
    # neither has finished.
    When I choose the agent "opencode"
    And I ask the agent "slow"
    Then the chat shows a running tool call
    When I type "hello" into the chat
    And I send the chat message
    Then the chat shows my message "hello"
    And the agent is working
    And the chat has not answered "opencode says: hello"
    # ... and the call the FIRST turn is still making is still running. A turn
    # that starts beside another must not mark the other's calls abandoned:
    # they are live, and a clock that stopped here would be the panel saying a
    # running call had been walked away from.
    And the chat says how long a running call has been going
    When the agent is released
    Then the chat eventually shows "done dawdling"
    And the chat eventually shows "opencode says: hello"
    And the agent is idle

  @opencode @scratch:chat
  Scenario: The panel settles when the LAST turn ends, not the first
    # Two held turns, one behind the other. The first ending is not the
    # conversation ending — a panel that went idle there would be reporting a
    # state it can see it is not in, over a turn still doing work.
    When I choose the agent "opencode"
    And I ask the agent "slow"
    And I ask the agent "slow"
    Then the chat shows a running tool call
    When the agent is released
    Then the chat eventually shows "done dawdling"
    And the agent is working
    When the agent is released
    Then the agent is idle

  @opencode @scratch:chat
  Scenario: Cancel is about everything in flight, not the newest of it
    # A person pressing cancel means the things they have going. With a message
    # queued behind the running turn there are two, and both end — the panel
    # settles rather than sitting at "working" over a turn nobody will ever
    # hear from.
    When I choose the agent "opencode"
    And I ask the agent "slow"
    And I type "hello" into the chat
    And I send the chat message
    Then the agent is working
    When I cancel the turn
    Then the agent is idle
    And the chat says the turn was cancelled
    And the chat has not answered "opencode says: hello"

  @opencode @scratch:chat
  Scenario: Starting another chat asks again, and can be backed out of
    # The other door into the same question, and the one difference between
    # them: a person who pressed `+ new` still has the conversation they were
    # in, so a misclick must not be a one-way door into a question. The panel's
    # OWN question has nothing behind it to go back to and offers no such way
    # out.
    When I choose the agent "opencode"
    And I ask the agent "hello"
    Then the chat eventually shows "opencode says: hello"
    When I start a new conversation
    Then the panel asks which agent
    When I keep the conversation I am in
    Then the panel does not ask which agent
    And the header names the agent "opencode"
    And the chat eventually shows "opencode says: hello"
    # ... and answering it starts a conversation with the agent that was picked,
    # which is the whole of "a new chat asks".
    When I start a new conversation
    And I choose the agent "claude"
    Then the header names the agent "claude"
    And the chat is empty

  @opencode @agent-stored @scratch:chat
  Scenario: Reopening the conversation talks to the agent that has it
    # The note beside the session id. A session id means nothing to the other
    # agent — asking it to load one gets a refusal — so the boot has to know
    # which agent this conversation is with before it has one to ask. It comes
    # back without asking again, in the same conversation, on the same agent.
    When I choose the agent "opencode"
    Then the chat eventually shows "opencode remembers this conversation"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the panel does not ask which agent
    And the header names the agent "opencode"
    And the chat eventually shows "opencode remembers this conversation"

  @no-agent @scratch:chat
  Scenario: With no agent at all, the panel says how to get one
    # An empty roster shows install instructions rather than an empty list —
    # the panel answers the question a person actually has, which is what to do
    # about it. Reached the way somebody would reach it deliberately:
    # `OLAI_ACP_AGENT` set to the empty string, which is the whole off switch
    # rather than one missing row.
    Then the panel says there is no agent
    And the panel tells me how to install "opencode"
    And the panel explains how to configure one, naming "OLAI_ACP_AGENT"
    # ...and it says WHICH of the three ways it got here rather than hedging
    # across them. This one is the off switch, and the sentence is about that.
    And the panel says the agent is switched off
    And there is nothing to type into
    # And the outlines are unaffected: serving a directory never depended on an
    # agent being installed.
    And the outline list is shown

  @plugins:odu @scratch:chat
  Scenario: A serve that enabled no engine says THAT, rather than guessing
    # THE CASE THE FACE USED TO MISS ENTIRELY, and the commonest real one now
    # that every engine is a plugin: all three engine rows are ENABLED BY
    # DEFAULT, so the way to end up with no agent is to name a `--plugins` list
    # without one in it. Nothing reads `OLAI_ACP_AGENT` in that state — there is
    # no claude fiber to read it — so the old copy's advice ("point it at an
    # executable that speaks ACP") would have changed nothing, and its other
    # guess, a start that skipped the wrapper, cannot happen at all: every
    # documented way of starting olai bakes the pinned adapter in.
    #
    # The server is the only end that can tell this apart from the other two —
    # it holds the engine registry — so it sends which, and the panel says it.
    Then the panel says there is no agent
    And the panel says this serve enabled no agent engine
    # ...and there is nothing to list, because an engine's install sentence is
    # its own browser half's and no engine half was fetched.
    And the panel offers no way to install one
    And there is nothing to type into
    And the outline list is shown

  @opencode @scratch:chat
  Scenario: A turn that ends having said nothing says so
    # THE AUTH FAILURE, and the reason it needed a scenario rather than a unit
    # test: nothing about it is an error. opencode with a provider key it cannot
    # resolve takes the prompt, sends one zero-token usage report and answers
    # `end_turn` — successfully. Every layer between the wire and the panel was
    # working exactly as designed, and what a person got for their message was
    # an empty space under it and a panel back at ready.
    When I choose the agent "opencode"
    And I ask the agent "silent"
    # THE CLAIM: the turn is accounted for. The words are the point — a person
    # reading this has to be told where to look, and the environment is the
    # trap (an agent olai spawns inherits olai's, not a login shell's).
    Then the chat eventually shows "ended the turn without saying anything"
    And the chat eventually shows "provider key"
    # ... and the banner is still up, unlike every other way a turn ends. A
    # notice scrolls with the transcript, and the next thing somebody does is
    # send again.
    And the panel says something went wrong
    And the agent is idle

  @opencode @scratch:chat
  Scenario: An ordinary turn is not accused of silence
    # The other half, and the one that would make the arm above useless: it
    # costs a turn that said anything at all nothing, and a panel that
    # complained after every answer would be a panel nobody reads.
    When I choose the agent "opencode"
    And I ask the agent "hello"
    Then the agent's answer mentions "opencode says: hello"
    And the chat does not yet show "ended the turn without saying anything"
    And the chat says nothing went wrong

  @opencode @scratch:chat
  Scenario: A turn somebody stopped is not accused of it either
    # A cancelled turn has a notice of its own. Blaming the agent for obeying
    # would be the panel arguing with the person who pressed the button.
    #
    # `hush` rather than `slow`, and that is the whole of what this pins: a
    # held turn that has ANNOUNCED something is a turn the silence arm would
    # skip anyway, so cancelling one asserts the outcome without reaching the
    # arm. This turn says nothing at all, so the cancel lands with the count
    # untouched — which is the ordinary case (a person stops a turn before it
    # has produced anything) and the one place the early return is the only
    # thing standing between them and being told the agent went quiet on them.
    When I choose the agent "opencode"
    And I ask the agent "hush"
    # The only thing there IS to wait for, which is the point.
    Then the panel says it is busy, with "working"
    When I cancel the turn
    And the agent is released
    Then the chat says the turn was cancelled
    And the chat does not yet show "ended the turn without saying anything"
    And the agent is idle

  @opencode @scratch:chat
  Scenario: A turn that failed after a usage frame is a message that did not land
    # The other half of the split, and the half that has no face of its own: a
    # usage report is not something a person can SEE, so a turn that sends one
    # and then refuses has produced nothing — the words did not land, and the
    # row has to say so and offer them again. The old single count read that
    # frame as the agent having worked on the message and left it looking sent.
    When I choose the agent "opencode"
    And I ask the agent "error-silent"
    Then the chat shows my message "error-silent" as "refused"
    And the strip under my message "error-silent" reads "not sent"
    # ... and it is the REFUSAL a person is told about, not a silence: the agent
    # answered, in its own words.
    And the chat eventually shows "No api key passed in"

  @opencode @scratch:chat
  Scenario: While a turn runs, the panel says so where a person is looking
    # The header has said this in small mono chrome beside the model for a
    # while, and it was not enough: the reader has just pressed enter, so their
    # eye is at the bottom of the panel. This is the line under their own
    # message.
    When I choose the agent "opencode"
    And I ask the agent "slow"
    Then the panel says it is busy, with "working"
    # ... and it goes away, which is the other half of a cue being a cue.
    When the agent is released
    Then the agent is idle
    And the panel does not say it is busy

  @opencode @agent-stored @scratch:chat
  Scenario: A message sent while a freshly picked agent is starting is delivered once
    # Choosing an agent starts a subprocess, hand-shakes it and opens a
    # conversation. That is the longest window this panel has, the box is
    # deliberately not locked while it lasts, and a message typed into it used
    # to race the open — two identical rows and two answers, which is the one
    # outcome a person cannot undo by pressing anything.
    Then the panel asks which agent
    When the next agent boot will hang
    And I choose the agent "opencode" without waiting for it
    # THE PANEL SAYS SO AT ONCE. The press flips it, rather than leaving it
    # reporting `idle` until the server's first frame comes back — a panel that
    # looks finished is a panel somebody presses again.
    Then the panel says it is busy, with "starting"
    When I ask the agent "hello"
    And the agent is released
    # THE CLAIM, and it is a COUNT: the words waited for the conversation and
    # went into it once.
    Then the agent has answered "opencode says: hello" exactly once
    And the chat shows my message "hello" exactly once

  @opencode @agent-stored @scratch:chat
  Scenario: The unassigned list is every agent's, grouped by who they are with
    # One agent at a time is true of the PROCESS and was never true of the
    # history. The list used to be asked of whichever agent the panel happened
    # to be talking to, so a single opencode chat took every Claude
    # conversation in this directory off the screen — and the way back to one
    # was to start a new Claude chat purely so the list would name them again.
    When I choose the agent "opencode"
    Then the header names the agent "opencode"
    When I open the unassigned chats
    # BOTH, from a panel talking to one of them. The other was started to
    # answer the question and stopped again — a listing is a question, not a
    # visit.
    Then the unassigned list shows "an opencode conversation" under the agent "opencode"
    And the unassigned list shows "an older conversation" under the agent "claude"
    And the unassigned list is grouped under the agent "claude"
    And the unassigned list is grouped under the agent "opencode"

  @opencode @agent-stored @scratch:chat
  Scenario: A row says how big its conversation is, and which conversation replaced it
    # `/clear` ends one conversation and starts another under a shared title,
    # and ACP's SessionInfo answers four fields and stops — so the list used
    # to answer "which of these two is the live one" with nothing. What the
    # fixture carries is the pinned adapter's own answer (the patch olai
    # ships, `packages/plugins/claude/acp/patches/session-list-info.patch`): the count per row, and
    # on the OLDER of the pair, which conversation replaced it.
    When I choose the agent "claude"
    And I open the unassigned chats
    Then the row for "the last conversation" says it has one message
    And the row for "an older conversation" says it has 47 messages
    And the row for "an older conversation" was superseded by "the last conversation"
    And the row for "the last conversation" was not superseded
    # ... while an agent whose list carries no corner says nothing — never a
    # zero standing in for a reading nobody did.
    And the row for "an opencode conversation" shows no message count

  @opencode @agent-stored @scratch:chat
  Scenario: A superseded line that names a conversation the list no longer knows
    # The successor may have been deleted since the stamp was earned: the row
    # then carries a link with nothing at its end, and a link a reader cannot
    # click at must not draw — the adapter's "no second claimant" refusals
    # are the same posture one level down. The COUNT stays: it IS what the
    # transcript said, and while it does, the named-half of the sentence
    # alone goes.
    When I choose the agent "claude"
    And the conversation "fake-stored-new" is gone from the agent
    And I open the unassigned chats
    Then the row for "an older conversation" says it has 47 messages
    And the row for "an older conversation" was not superseded

  @opencode @agent-stored @scratch:chat
  Scenario: Picking another agent's conversation switches the panel to that agent
    # The consequence of the list spanning both: a row in it may belong to the
    # agent this panel is NOT talking to, and a session id means nothing to the
    # wrong agent. So opening it is a change of agent as well as of
    # conversation — the same change + new makes, through the same door.
    When I choose the agent "opencode"
    Then the header names the agent "opencode"
    When I open the unassigned chats
    And I pick the conversation "an older conversation"
    Then the header names the agent "claude"
    And the conversation is titled "an older conversation"
    And the chat input takes typing

  @agent-stored @scratch:chat
  Scenario: One agent on the machine is not a heading over the whole list
    # The picker's own rule, read at the other door: a heading naming the one
    # agent there is says what the panel's header already says, over every row
    # in the list.
    When I open the unassigned chats
    Then the unassigned list lists "an older conversation"
    And the unassigned list has no headings

  @opencode @agent-stored @scratch:chat
  Scenario: One agent that cannot be asked does not take the other's conversations
    # The two halves of the same rule, now that the list spans more than one
    # agent. An absent list drawn as "no stored conversations" is a claim about
    # somebody's disk standing in for never having reached them — the picker's
    # oldest bug — and a broken agent that took the WHOLE list down with it
    # would be the bug this fan-out exists to fix, one agent along.
    When I choose the agent "claude"
    And I ask the agent "lose"
    And I open the unassigned chats
    # Named, in its own words, as ONE agent's trouble.
    Then the list says "claude" could not be asked, with "the conversation store is unreadable"
    # ... and the other agent's are still there, which is the half a refusal
    # about the whole call would have taken away.
    And the unassigned list shows "an opencode conversation" under the agent "opencode"

  @pi @scratch:chat
  Scenario: pi on the machine is something the picker offers
    # The row is the PAIR: the pinned adapter (baked the way the claude one
    # is, never a floating install) AND a `pi` the probe found. With both, pi
    # is a choice beside claude; the scripted adapter is what the choice spawns.
    Then the panel asks which agent
    And the picker offers the agent "claude"
    And the picker offers the agent "pi"

  @pi @scratch:chat
  Scenario: A turn with pi, from the box to the answer — and the banner left out
    # pi-acp 0.0.33 opens a session by DOUBLING its editor-targeted startup
    # banner as an ordinary agent chunk (the `session/new` answer's
    # `_meta.piAcp.startupInfo` carries the exact string). Olai drops the
    # double, matched on the answer's own text: a transcript is a
    # conversation, this is not one, and the banner is also the one chunk
    # that could make a genuinely silent first turn look said.
    When I choose the agent "pi"
    Then the header names the agent "pi"
    And the header draws that agent's own mark
    When I ask the agent "hello"
    Then the chat eventually shows "pi says: hello"
    And the chat does not yet show "pi v0.84.2"
    And the page has not reloaded

  @pi @scratch:chat
  Scenario: A silent turn behind the banner is still named
    # The failure the banner-drop has to NOT make: pi-acp maps a model error
    # to a plain `end_turn` and sends nothing — no prose, no tool, not even
    # usage — so olai's silence arm is the whole of what a person gets. The
    # banner chunk, drawn as speech, would have counted as something said and
    # the arm would never fire on a conversation's FIRST turn, which is when
    # an unconfigured provider fails.
    When I choose the agent "pi"
    And I ask the agent "silent"
    Then the chat eventually shows "ended the turn without saying anything"
    And the chat does not yet show "pi v0.84.2"
    And the agent is idle

  @pi @scratch:chat
  Scenario: pi works a tool olai handed its conversation
    # THE PIN'S BRIDGE, answered: pi-acp (0.0.33) stores the session's
    # handed mcpServers and wires them nowhere — the pin patches its
    # `session/new` spawn into `-e <bridge>` + the servers in the process
    # env (packages/plugins/pi/acp/patches/README.md's pi-mcp-servers section), and the bridge
    # registers them on pi's own extension API under the SAME names this
    # surface already reads. The scenario mirrors the wire the patch mints:
    # an `olai_read_node:0` call — pending, in_progress, completed, with
    # the tool's answer riding its card. The round trip that is protocol-
    # true lives down in packages/plugins/pi/acp/mcp-bridge/roundtrip.test.js, one SDK pair
    # away from the real servers.
    When I choose the agent "pi"
    And I ask the agent "mcp read title install"
    Then the chat shows a completed tool call
    And the chat eventually shows "the node's title is install"

  @pi @scratch:chat
  Scenario: A message sent mid-turn to pi queues, with no interruption to offer
    # The one YES pi-acp earns not by advertisement but by the wire (the
    # spike): a prompt sent while a turn runs is held in the adapter's own
    # queue and answered in order. There is no steering extension —
    # `_session/steering` is -32601, and `/steering` in this adapter is a
    # slash command about pi's own delivery mode — so the gesture the claude
    # agent has is simply not drawn.
    When I choose the agent "pi"
    And I ask the agent "slow"
    Then the chat shows a running tool call
    And the composer says a message would queue
    And the composer offers no interruption
    When I type "hello" into the chat
    And I send the chat message
    Then the chat shows my message "hello"
    # ... and the wire's own answer to the queued message is what the panel
    # shows: the adapter's queue-announce chunk, spoken as speech where a
    # client shows speech. The composer claim above is the leg's word; this
    # line is the frames the word was the reading of.
    And the chat eventually shows "Queued message (position 1)."
    When the agent is released
    Then the chat eventually shows "done dawdling"
    And the chat eventually shows "pi says: hello"
    And the agent is idle

  @pi @agent-stored @scratch:chat
  Scenario: The unassigned list groups pi conversations under pi, carrying no counts
    # What the spike found: pi-acp's `session/list` honours the request's cwd
    # exactly and answers the protocol's four fields and nothing more — the
    # `_meta` of the answer is an empty OBJECT at response level, never a
    # corner on a row — so a pi row says nothing a claude row does: no count,
    # no "superseded by". Nothing drawn is not a zero.
    When I choose the agent "pi"
    And I open the unassigned chats
    Then the unassigned list shows "a pi conversation" under the agent "pi"
    And the unassigned list shows "an older conversation" under the agent "claude"
    And the row for "a pi conversation" shows no message count

  @pi @agent-stored @scratch:chat
  Scenario: Reopening a stored pi conversation talks to pi
    # `session/load` is the adapter's own session map reattaching a fresh pi
    # to the stored file; the replays are the conversation, and the note is
    # how the boot comes back without asking.
    When I choose the agent "pi"
    Then the chat eventually shows "pi remembers this conversation"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the panel does not ask which agent
    And the header names the agent "pi"
    And the chat eventually shows "pi remembers this conversation"
