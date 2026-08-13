Feature: Talking to the agent
  The panel is the second write surface, and the first one that exists. What it
  has to be is one thing: a place where asking for something CHANGES the
  outline in front of you, and where a change that was refused says why in
  terms you can act on.

  Every scenario here is `@scratch:chat` — the agent writes, so the directory
  is a private copy with a server of its own — and the agent behind them is the
  scripted one in `agent/fake-acp-agent.ts`. It calls the real internal MCP
  server over the real HTTP route, so what is being tested is the whole path
  minus the language model: panel, surface, ops, write gate, disk, store, and
  back to the page.

  Background:
    Given I open the app
    And I mark the page
    And the agent panel is open

  @scratch:chat
  Scenario: The agent checks something off and the tree follows
    # The claim the roadmap item is written against: ask, and watch the outline
    # update — no reload, no optimistic echo, the server's own snapshot.
    When I ask the agent "done order"
    Then node "order" is done
    And the page has not reloaded
    And the agent's answer mentions "marked"

  @scratch:chat
  Scenario: The agent captures a node and it appears in the tree
    When I ask the agent "add water the plants"
    Then the tree eventually shows a node titled "water the plants"

  @scratch:chat
  Scenario: A parent is marked like any other node
    # A mark is a stored fact on whatever carries it. `kitchen` has three
    # children, one of them still under way, and marking it done is an
    # ordinary write — a claim about the branch, which somebody is allowed to
    # make. Nothing derives a status any more, so there is nothing to refuse.
    When I ask the agent "done kitchen"
    Then node "kitchen" is done
    And the chat shows no refusal
    # ... and the rollup's remark rides the write's own story, where the person
    # who asked for it is looking — the same aside a keystroke already gets
    # under its row. Advice on a write that LANDED, never a reason one did not.
    And the chat says the write "marked done"
    And the write's nudge says "unfinished"

  @scratch:chat
  Scenario: A refused write shows its detail in chat
    # A refusal is DATA, not a sentence: the panel draws what the refusal
    # carried, so a person watching sees why rather than the agent's summary
    # of why. Nothing in the set declares `nowhere`.
    When I ask the agent "done nowhere"
    Then the chat shows a refusal

  @scratch:chat
  Scenario: The header names the model the session runs on
    # A turn's cost and character depend on the model and nothing else on the
    # page says which one. The agent reports it as a session config option and
    # a value the picker offers is shown by the picker's own LABEL, so what is
    # asserted is "Fake One" rather than the raw `fake-model-1` it came as.
    Then the panel header names the model "Fake One"

  @scratch:chat
  Scenario: A tool call is one foldable line
    When I ask the agent "done order"
    Then the chat shows a completed tool call
    And the tool call's detail is folded away

  @scratch:chat
  Scenario: A file the agent rewrote shows what changed, trimmed
    # The half of this feature that is NOT an outline. A direct edit to a `.md`
    # or a source file shows up in no tree, so until the panel drew the diff
    # the answer to "what did it change" was a terminal. Trimmed, because a
    # turn can rewrite four files and the panel is 26rem wide.
    When I ask the agent "edit"
    Then the chat shows a diff of "notes.md"
    And the diff is trimmed
    When I expand the diff
    Then the diff is expanded
    And the diff shows the line "- a walnut worktop, ordered on the tenth" as added

  @scratch:chat
  Scenario: An outline the agent rewrote by hand is still never a text diff
    # The rule is about the FILE, not about the tool that wrote it: a `.jsonl`
    # is one line per node, so a text diff of one is a single enormous line.
    # olai's own writes cannot produce one — they go through the ops layer —
    # but an agent's own `Edit` can name any file, and one aimed at an outline
    # used to arrive as a diff block and be drawn as ordinary lines.
    When I ask the agent "edit house.jsonl"
    Then the chat shows the outline "house.jsonl" changing
    And the outline change says "note rewritten"
    And the chat shows no diff

  @scratch:chat
  Scenario: A rewrite too big to compare says so rather than looking like a hunk
    # Past the comparison budget the two sides are reported as unrelated, so
    # every row is a change and the trimmed view shows the top of the OLD file
    # — which looks exactly like an ordinary diff and is not one.
    When I ask the agent "edit huge.md"
    Then the chat shows a diff of "huge.md"
    And the diff says it was rewritten whole

  @scratch:chat
  Scenario: An olai write tells its story instead of showing a diff
    # The other vocabulary, and the rule behind it: a `.jsonl` diff is one
    # enormous line per node with everything on it changing at once, which is
    # the commit panel's own reason for never showing one. So a write through
    # the ops layer is drawn as the node-level story, in the words the commit
    # panel already uses for the same event.
    When I ask the agent "done order"
    Then the chat says the write "marked done"
    And the chat shows no diff

  @scratch:chat
  Scenario: A turn can be cancelled mid-stream
    When I ask the agent "slow"
    Then the agent is working
    When I cancel the turn
    Then the agent is idle
    And the chat says the turn was cancelled

  @scratch:chat
  Scenario: A cancel that did not stop the turn says so
    # The regression this exists for: the button was pressed, the turn went on
    # streaming, and nothing on screen said so. A cancel is a NOTIFICATION —
    # written, never answered — and a pipe reports nothing back to the writer
    # even when the reader has gone, so the write succeeding was evidence of
    # nothing and every way of failing looked like success. The only honest
    # evidence is the turn itself. `deaf` is an agent that has stopped reading
    # and gone quiet with its turn still open, which is that shape of failure
    # on purpose.
    When I ask the agent "deaf"
    Then the agent is working
    When I cancel the turn
    Then the chat eventually shows "the agent was asked to stop and has said nothing since"
    And the agent is working

  @scratch:chat
  Scenario: An agent still working towards the stop is not accused of ignoring it
    # The other half, and the reason the panel watches SILENCE rather than a
    # clock: a cancel lands between a turn's own steps, so an adapter in the
    # middle of a long tool call honours it when that step returns. A window on
    # the turn alone would call every one of those dead. `talkative` ignores
    # the cancel and keeps streaming, which is what that looks like from here.
    When I ask the agent "talkative"
    Then the agent is working
    When I cancel the turn
    Then the agent's answer mentions "still working 7"
    And the chat says nothing went wrong

  @scratch:chat
  Scenario: An answer this panel cannot draw leaves a mark, not a blank
    # The panel renders text and nothing else, which is fair — doing it
    # SILENTLY was not. An agent answering with a picture, a sound or an
    # attached resource used to leave a gap in the transcript that reads
    # exactly like an agent that said nothing at all.
    When I ask the agent "picture"
    Then the agent's answer mentions "here it is:"
    And the agent's answer mentions "[image]"

  @scratch:chat
  Scenario: The input completes the agent's own slash commands
    # The list is the AGENT'S — olai keeps none of its own — so what is offered
    # is whatever that agent reported over the session.
    When I type "/re" into the chat
    Then the completion offers "review"
    When I accept the completion
    Then the chat input reads "/review "

  @agent-stored @scratch:chat
  Scenario: Boot adopts the conversation this directory was last in
    # `session/list` for this directory answers with two, and the most recently
    # updated one is the one the panel comes up in — replayed, before anybody
    # types.
    Then the chat eventually shows "we decided to order the cabinets"
    And the conversation is titled "the last conversation"

  @agent-stored @scratch:chat
  Scenario: The conversation survives a restart of the server
    Given the chat eventually shows "we decided to order the cabinets"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the chat eventually shows "we decided to order the cabinets"

  @no-agent @scratch:chat
  Scenario: With no agent, the panel says so rather than disappearing
    # The one state a person should never reach by following a documented way
    # of starting olai — `nix run`, the packaged binary and `just serve` all
    # come with the pinned adapter. Reached here the way somebody would reach
    # it deliberately: `OLAI_ACP_AGENT` set to the empty string.
    #
    # The panel still DRAWS. A capability that is silently absent cannot be
    # told apart from one that is broken, or from one you have not found yet.
    Then the panel says there is no agent
    And the panel explains how to configure one, naming "OLAI_ACP_AGENT"
    And there is nothing to type into
    # And the outlines are unaffected: serving a directory never depended on
    # an agent being installed, and that is what "off" costs.
    And the outline list is shown

  @agent-stored @scratch:chat
  Scenario: A picker that could not ask says so, not "no conversations"
    # "There are none" and "we could not find out" are different answers, and
    # a refusal used to arrive as an empty list and be drawn as the first —
    # a claim about the agent's disk standing in for never having read it.
    When I ask the agent "lose"
    And I open the session picker
    Then the picker refuses, saying "the conversation store is unreadable"
    And the picker lists nothing

  @agent-stored @scratch:chat
  Scenario: The picker switches conversations
    When I open the session picker
    Then the picker lists "an older conversation"
    When I pick the conversation "an older conversation"
    Then the conversation is titled "an older conversation"

  @scratch:chat
  Scenario: The panel shows the turn happening, not only its result
    # Racket's chat.feature had this and this branch did not, which is how a
    # rendering bug that only exists WHILE a turn runs got as far as it did.
    # `hold` stops the agent mid-turn, so the states a person actually watches
    # — a call running, an answer growing — can be asserted while they are
    # true rather than reconstructed from what is left afterwards.
    When I ask the agent "hold"
    Then the agent is working
    And the chat shows a running tool call
    And the chat is streaming an answer
    When the agent is released
    Then the agent is idle
    And the chat shows a completed tool call
    And the agent's answer mentions "and done"
    And the chat is not streaming

  @scratch:chat
  Scenario: A running tool call says what it is doing, before it is done
    # ACP's tool_call_update carries incremental content and follow-along file
    # locations, and neither was read: an unfolded running call showed the
    # arguments it was given and then nothing at all until it completed, which
    # is indistinguishable from one that had hung. Every assertion here is made
    # while the call is still in progress — afterwards, a result would do.
    When I ask the agent "hold"
    Then the chat shows a running tool call
    And the tool call says where it is working
    When I unfold the tool call
    Then the tool call is reporting "halfway through"
    And the chat shows a running tool call
    When the agent is released
    Then the chat shows a completed tool call

  @scratch:chat
  Scenario: A running turn is visible in three places
    # Ported back from racket, which had all three and this branch had none of
    # them: the only cue was the send button turning into cancel. One cue is not
    # enough because a person is not always looking at the one place it is —
    # and a turn behind a closed panel used to be invisible including when it
    # ended — the header toggle's busy pulse is that cue, and it stays on
    # screen whether the drawer is open or shut.
    When I ask the agent "hold"
    Then the agent is working
    # BESIDE the model, not instead of it. The status used to give that line up
    # the moment a model was named, so from the second turn on the header
    # answered a different question than the one being asked of it.
    And the panel header names the model "Fake One"
    And the header says the agent is working
    # Close via the permanent header toggle (no × in the panel). The toggle
    # stays visible, unpressed, and still busy while the turn runs.
    When I close the agent panel
    Then the agent toggle says a turn is running
    When I open the agent panel again
    And the agent is released
    Then the agent is idle
    And the header has stopped saying the agent is working
    And the panel header names the model "Fake One"

  @scratch:chat
  Scenario: A row that changes is the same row, not a new one
    # The headline of the parity round. Rows are keyed by id and each row reads
    # its own value, so a status change patches the row in place. Handed the
    # entry OBJECTS instead — which the server re-mints on every upsert, every
    # streamed token — the panel disposed and rebuilt every row several times a
    # second, and everything a row owns went with it: a fold, a text selection,
    # the scroll position under the reader's eye.
    #
    # Asserted on the ELEMENT rather than on any of those, because the element
    # surviving is the property, and each of the rest is only a symptom of it.
    When I ask the agent "hold"
    Then the chat shows a running tool call
    And the chat is streaming an answer
    When I mark the tool call's element
    And I mark the streaming answer's element
    Then the answer has grown
    And the streaming answer is the element I marked
    When the agent is released
    Then the chat shows a completed tool call
    And the tool call is the element I marked

  @scratch:chat
  Scenario: A tool call I unfolded stays unfolded while the panel keeps moving
    # Two things move under an unfolded line: the call's own status, and the
    # next turn arriving. A fold that shuts under either is a fold that shuts
    # exactly when somebody opened it to watch something.
    When I ask the agent "hold"
    Then the chat shows a running tool call
    When I unfold the tool call
    Then the tool call's detail is shown
    When the agent is released
    Then the chat shows a completed tool call
    And the tool call's detail is shown
    When I ask the agent "done order"
    Then the agent is idle
    And the tool call's detail is shown

  @scratch:chat
  Scenario: The header follows the model the agent is actually running
    # Two sources: the session's config option is what was PICKED, and the
    # CLI's own init message is what is RUNNING. A `/model` is handled inside
    # the wrapped CLI, so the picker never hears about it — a header reading
    # only the picker names the model the session STARTED on, forever.
    Then the panel header names the model "Fake One"
    When I ask the agent "model fake-model-2"
    Then the panel header names the model "Fake Two"

  @scratch:chat
  Scenario: A message sent mid-turn waits its turn instead of being refused
    # The box used to be turned OFF while the agent worked, and a send while it
    # was on was refused. Both were wrong in the same way: a person watching a
    # turn has the next thing ready long before it ends, and the panel made
    # them hold it — then took the caret away, so coming back meant reaching
    # for the mouse.
    When I ask the agent "hold"
    Then the agent is working
    And the chat input takes typing
    When I ask the agent "done order"
    Then the chat says 1 message is queued
    And the chat input still has the caret
    # It is a row already: what was said, in the order it will be asked.
    And the chat eventually shows "done order"
    And the agent is working
    When the agent is released
    # ... and the queued one runs on its own, with nothing else pressed.
    Then nothing is queued any more
    And the agent is idle
    And node "order" is done

  @scratch:chat
  Scenario: The transcript follows the newest line, unless I have scrolled away
    # It stopped following, and the reason is the shape of the two questions.
    # Whether a reader is following is a decision they make by SCROLLING, and it
    # was being re-derived from the scroll position after new content had
    # already pushed the bottom out of reach — so a long answer read as "they
    # have scrolled away" the instant it arrived. And what grows is the text
    # inside a row, not the list of rows, so watching the list saw the
    # paragraph appear and none of the four hundred tokens that filled it.
    When I ask the agent "flood"
    Then the agent is idle
    And the transcript is scrolled to the newest line
    When I scroll the transcript to the top
    And I ask the agent "flood"
    Then the agent is idle
    And the transcript has stayed where I left it

  @scratch:chat
  Scenario: The agent's question is a form in the conversation, and the answer goes back
    # The panel advertises `elicitation.form`, so the agent may ask a
    # structured question at all — without it the adapter puts AskUserQuestion
    # in `disallowedTools` and the agent has to guess instead. The scripted
    # agent refuses to ask unless the capability arrived, so this scenario
    # fails if the client ever stops sending it.
    When I ask the agent "ask"
    Then the chat shows a question
    And the question offers "oak"
    # The turn is STOPPED on a person and nothing times out, so every place a
    # reader might be looking has to say so.
    And the composer says the agent is waiting on me
    And the header says the agent is working
    When I choose "birch"
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "\"question_0\":\"birch\""
    # The form stays where it was asked, disabled, with what was chosen on it.
    And the question has been answered
    And the question can no longer be answered

  @scratch:chat
  Scenario: The free-text box beside a question is what travels
    # The agent sends its "Other" box as a field of its own, marked with the
    # question it belongs to; drawn as a second question it would read as one.
    # A typed answer takes precedence over the chip, which is the agent's own
    # rule — so what has to arrive is the words, not the option underneath.
    When I ask the agent "ask"
    Then the chat shows a question
    When I choose "oak"
    And I type "walnut, actually" into the question's other box
    And I answer the question
    Then the agent's answer mentions "\"question_0_custom\":\"walnut, actually\""

  @scratch:chat
  Scenario: Dismissing a question tells the agent, rather than answering for me
    # The one thing this must never be is a fabricated answer. A dismissal is a
    # decline on the wire — the agent is told a person would not say — and the
    # row afterwards says which of the two happened.
    When I ask the agent "ask"
    Then the chat shows a question
    When I dismiss the question
    Then the agent is idle
    And the agent's answer mentions "\"action\":\"decline\""
    And the question says I dismissed it

  @scratch:chat
  Scenario: A cancelled turn takes its question back
    # A question holds the ACP request open, and cancelling the turn aborts it —
    # so the form has to stop being a live control the moment the agent stops
    # waiting for it. A form left answerable on a turn that is over is a button
    # that does nothing, and pressing it is how a person would find out.
    When I ask the agent "ask"
    Then the chat shows a question
    When I cancel the turn
    Then the agent is idle
    And the question says the agent took it back
    And the composer has stopped saying the agent is waiting on me

  @scratch:chat
  Scenario: Leaving plan mode is asked, not assumed
    # The hole this item closed. The adapter maps ExitPlanMode onto a permission
    # request whose FIRST allow-flavoured option switches the session to "auto"
    # — and the panel used to answer every permission request with the first
    # allow it found, so it was quietly taking that decision on somebody's
    # behalf, every time, invisibly.
    When I ask the agent "plan"
    Then the chat shows a question
    And the question offers "auto"
    When I choose "No, keep planning"
    And I answer the question
    Then the agent's answer mentions "permission: plan"

  @scratch:chat
  Scenario: An answer the question refuses keeps what I typed
    # The server refuses an answer that does not fit the schema that asked for
    # it and DELIBERATELY leaves the question waiting, so nothing is recorded
    # that the agent was never sent. The panel used to throw the draft away on
    # the click regardless — so the refusal arrived under a form that had gone
    # blank, and the only way to act on it was to type the whole thing again.
    # `howMany` is required and left empty, which is the refusal a person can
    # actually reach: a number box will not take letters in the first place, so
    # the browser is the earlier gate and the server is this one.
    When I ask the agent "askstrict"
    Then the chat shows a question
    When I type "the oak ones" into the question's "note" box
    And I answer the question
    Then the chat shows a refusal
    And the chat shows a question
    And the question's "note" box still reads "the oak ones"
    # ... and it is still answerable, which is what "still waiting" has to mean
    # for the person looking at it.
    When I type "40" into the question's "howMany" box
    And I answer the question
    Then the question has been answered
    And the agent's answer mentions "\"howMany\":40"
    And the agent's answer mentions "the oak ones"

  @scratch:chat
  Scenario: A tool nothing has named is asked about, not approved
    # The other half of recognising our own tools POSITIVELY. Nothing announced
    # this call and its title is not an MCP tool id, so the panel cannot tell
    # what it is — and the rule is that what it cannot name, a person answers.
    # Approving by failing to recognise something is the failure this direction
    # of the rule exists to make impossible.
    When I ask the agent "nameless"
    Then the chat shows a question
    And the question offers "reject"
    When I choose "Deny"
    And I answer the question
    Then the agent's answer mentions "permission: reject"

  @scratch:chat
  Scenario: An answered question is still there after a reload
    # The form is a ROW, and a row is transcript — so it comes back the way
    # every other row does, on the first frame of a fresh subscription, with no
    # replay protocol. That is the whole reason a question is an entry rather
    # than a modal: what you were asked and what you said is a thing about the
    # conversation, not about the tab that happened to be open.
    When I ask the agent "ask"
    Then the chat shows a question
    When I choose "birch"
    And I answer the question
    Then the question has been answered
    When I reload the page
    And the agent panel is open
    Then the question has been answered
    And the question shows "birch" as what I chose

  @scratch:chat
  Scenario: Permission for an ops tool needs nobody
    # Bypass mode is the design and these are the tools it is for: mediated,
    # validated, and olai's own. A form here would be a click on every write.
    When I ask the agent "permit"
    Then the agent is idle
    And the agent's answer mentions "permission: allow"
    And the chat shows no question

  @scratch:chat
  Scenario: A new conversation empties the panel
    # The panel shows ONE conversation. A break line under the old rows was
    # tried and is not what "new conversation" means to the person who pressed
    # it: the agent's context is gone, so nothing above could be followed up,
    # and a transcript you cannot refer to is history kept for its own sake.
    When I ask the agent "hello"
    Then the agent's answer mentions "you said: hello"
    When I start a new conversation
    Then the chat is empty

  @scratch:chat
  Scenario: A pasted picture reaches the agent as a file it can read
    # The whole claim of the design, end to end: the bytes go from a Blob in
    # this tab into a tmp directory of the conversation's own, and what the
    # agent is handed is the PATH. So what is asserted is that the agent READ
    # the file — a size it can only have got off the disk — and not that a chip
    # appeared. The chip is asserted too, because the transcript is where a
    # reader learns which picture went with which message.
    When I paste a picture called "shot.png" into the chat
    Then the composer is holding the picture "shot.png"
    When I ask the agent "what is this"
    Then the agent's answer mentions "read 70 bytes from shot.png"
    And the conversation shows the picture "shot.png"

  @scratch:chat
  Scenario: A kind olai does not take is refused before it is uploaded
    # An SVG is a picture as far as the clipboard is concerned and a document
    # that can script as far as this app is concerned — so it is in neither of
    # the two lists the gate keeps, while a PDF and a text file are in one of
    # them. The gate is one module both ends read, so the browser refuses
    # exactly what the server would have — before spending an upload finding
    # out.
    When I paste a picture called "logo.svg" into the chat
    Then the chat eventually shows "cannot be attached"
    And the composer is holding nothing

  @scratch:chat
  Scenario: A picture dropped on the panel reaches the agent the same way
    # Drop is the gesture for a file that is already on screen, and what it is
    # aimed at is the CONVERSATION — so the target is the panel's whole body
    # and not the two-line box at the bottom of it. The drag is dispatched at
    # the transcript, which is the part furthest from the composer: a drop that
    # only worked over the box would pass a test aimed at the box and fail the
    # person aiming at the panel.
    #
    # Nothing below the gesture is new. The assertion is the same one the paste
    # scenario makes — the agent READ the file, a size it can only have got off
    # the disk — because that is what "through the existing pipeline" means.
    When I drag "shot.png" over the chat panel
    Then the panel shows where the drop will land
    # Enter and leave fire per ELEMENT, not per target, so a drag crossing the
    # panel leaves each thing it passes over the instant it enters the next.
    # Counted, that is one drag; flagged, it is a panel that flickers the whole
    # way across and goes dark under the cursor.
    When the drag moves onto the composer
    Then the panel shows where the drop will land
    When I drop "shot.png" on the chat panel
    Then the composer is holding the picture "shot.png"
    And the panel is not offering to take a drop
    When I ask the agent "what is this"
    Then the agent's answer mentions "read 70 bytes from shot.png"
    And the conversation shows the picture "shot.png"

  @scratch:chat
  Scenario: A drag that ends without a drop takes the affordance with it
    # The panel counts the drag in and out, and the counting is what survives a
    # transcript's worth of rows. What it must not do is keep count of a drag
    # that has gone: "drop to attach" left lit over a conversation, with
    # nothing over it and nothing to release, is a panel that looks broken and
    # cannot be talked out of it. Both endings arrive carrying nothing — the
    # drag data is protected until a drop that never happened — so neither can
    # be recognised by what it holds, only by the fact that it ended.
    When I drag "shot.png" over the chat panel
    Then the panel shows where the drop will land
    When the drag leaves the panel without dropping
    Then the panel is not offering to take a drop
    When I drag "shot.png" over the chat panel
    Then the panel shows where the drop will land
    When the drag is cancelled
    Then the panel is not offering to take a drop

  @scratch:chat
  Scenario: A drag carrying no files is none of the panel's business
    # Dragging a selection into the box is the browser's own gesture and it
    # goes on working: the panel reads what the drag is CARRYING before it
    # offers to take it, and takes nothing it was not offered.
    When I drag some selected text over the chat panel
    Then the panel is not offering to take a drop

  @scratch:chat
  Scenario: Several files in one drop attach in the order they were dropped
    # A drop is one gesture over several files, so the order is the person's:
    # they selected them in that order and let go of them together. The chips
    # keep it, the prompt keeps it, and the agent reads them in it.
    When I drop "one.png, two.png, three.png" on the chat panel
    Then the composer is holding "one.png, two.png, three.png" in that order
    When I ask the agent "what are these"
    Then the agent read "one.png, two.png, three.png" in that order

  @scratch:chat
  Scenario: A dropped PDF and a dropped text file reach the agent as files it reads
    # The human's ruling, end to end: what a person drags at a conversation is
    # not always a picture, and "not a picture" was a refusal for the commonest
    # thing there is to drag at an agent. The gate takes documents now — the
    # SAME gate, widened in the one module both ends read — and nothing under
    # the gesture changed: same chunk loop, same tmp directory, same path in
    # the prompt.
    #
    # What is asserted is the agent READING each one — a size it can only have
    # got off the disk, and two different sizes so neither can be the other's
    # answer. The chips are asserted for what a document chip must NOT do:
    # draw an <img> at a PDF, which is a broken-image icon standing where a
    # perfectly uploaded file should be. It says how big it is instead.
    #
    # The dropped name has a SPACE in it, which is the name the human's own
    # file had. What comes back is `Type_04-C.pdf`: the server sanitises a name
    # into one safe basename before it writes it, and the chip carries the
    # server's answer rather than what this tab sent — so this scenario walks
    # that rename end to end as well.
    When I drop "Type 04-C.pdf, notes.txt" on the chat panel
    Then the composer is holding "Type_04-C.pdf, notes.txt" in that order
    And the composer is holding "Type_04-C.pdf", showing how big it is
    And the composer is holding "notes.txt", showing how big it is
    When I ask the agent "what are these"
    Then the agent's answer mentions "read 69 bytes from Type_04-C.pdf"
    And the agent's answer mentions "read 5 bytes from notes.txt"

  @scratch:chat
  Scenario: A picked file goes in the same way a dropped one does
    # The third gesture, and the one a phone has instead of the other two. It
    # is here because the picker has an `accept` of its own: a dialog that will
    # not OFFER a PDF the gate would take is the one half-truth a person meets
    # without any refusal to explain it — the file is simply greyed out.
    When I pick "Type 04-C.pdf" with the attach button
    Then the composer is holding "Type_04-C.pdf", showing how big it is
    When I ask the agent "what is this"
    Then the agent's answer mentions "read 69 bytes from Type_04-C.pdf"

  @scratch:chat
  Scenario: A dropped file olai cannot take says so, by name
    # HACKING's rule, at the gesture where it is easiest to break: a file that
    # is dragged somewhere and then disappears has been swallowed, and the
    # person who dropped it has no way to tell that from a slow upload.
    When I drop "archive.zip" on the chat panel
    Then the chat eventually shows "cannot be attached"
    And the chat eventually shows "archive.zip"
    And the composer is holding nothing

  @scratch:chat
  Scenario: A drop that is half pictures takes them and names what it would not
    # The mixed drop, which is the one a person actually makes: a folder's
    # worth of files selected together. The pictures attach and the rest is
    # refused BY NAME — and the refusal has to survive the uploads that follow
    # it, which is why the drop is sorted before any of it is sent rather than
    # judged file by file on the way out.
    When I drop "shot.png, archive.zip" on the chat panel
    Then the composer is holding the picture "shot.png"
    And the chat eventually shows "archive.zip"
    When I ask the agent "what is this"
    Then the agent's answer mentions "read 70 bytes from shot.png"
