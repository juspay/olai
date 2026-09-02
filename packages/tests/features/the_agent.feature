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
    # Nearly every turn these scenarios run ends by watching a row TAKE the
    # mark — so this page keeps its finished rows drawn for them, or the row
    # would go at exactly the moment the tree-follow is the claim.
    And I show the done nodes
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
  Scenario: A parent is marked like any other node once the branch is finished
    # The gate is about unfinished work and nothing else: `install the
    # cabinets` is the only task under the branch, so finishing it is what the
    # refusal above asks for — and the rollup's remark rides that write's own
    # story, where the person who asked for it is looking, the same aside a
    # keystroke gets under its row. Advice on a write that LANDED, never a
    # reason one did not. `order the new cabinets` is a bullet, so it is not
    # unfinished work and never was in the way.
    When I ask the agent "done install"
    Then node "install" is done
    And the chat shows no refusal
    And the chat says the write "marked done"
    And the write's nudge says "every task under `kitchen remodel #home` is done now"
    When I ask the agent "done kitchen"
    Then node "kitchen" is done

  @scratch:chat
  Scenario: A refused write shows its detail in chat
    # A refusal is DATA, not a sentence: the panel draws what the refusal
    # carried, so a person watching sees why rather than the agent's summary
    # of why. Nothing in the set declares `nowhere`.
    When I ask the agent "done nowhere"
    Then the chat shows a refusal

  @scratch:chat
  Scenario: What you said is not what the agent said
    # The human's own words used to sit in a faint box that read as another
    # agent paragraph — a glance could not tell them apart. They sit on the
    # right now, in an accent-tinted bubble, so the two speakers are two shapes.
    When I ask the agent "hello"
    Then the chat shows my message "hello"
    And the agent's answer mentions "you said: hello"
    And my message sits to the right of the agent's

  @scratch:chat
  Scenario: A tool call is one foldable line
    When I ask the agent "done order"
    Then the chat shows a completed tool call
    And the tool call's detail is folded away

  @scratch:chat
  Scenario: A report that arrives twice is one report
    # Nothing in ACP forbids an agent repeating itself and more than one does
    # it, byte for byte. A repeat is not a second report: the transcript is
    # keyed by the agent's own call id, so what a repeat can produce is exactly
    # what the first frame already produced — one row, one result, one turn that
    # ends. The frames go down the real pipe in the real order here, which is
    # what the rule's own unit tests cannot say.
    When I ask the agent "twice"
    Then the chat shows 1 tool call
    And the chat shows a completed tool call
    And the agent's answer mentions "said the same thing twice"
    And the agent is idle

  @scratch:chat
  Scenario: The conversation is the main agent's, and a subagent's calls are behind a door
    # The human, with a screenshot of the panel drowning: five survey agents
    # out, and the transcript a wall of other agents' `cd … && grep …` with the
    # main agent's own words pushed off the top of the screen. Being able to
    # tell WHOSE wall of text you are drowning in — which is what the lanes
    # bought — is not the same as not drowning.
    #
    # So the column is the main agent's. What is left of a fan-out in it is the
    # calls the main agent itself made, each with a door under it saying how
    # much is behind it. Two agents, three calls between them.
    When I ask the agent "subagent"
    Then the conversation carries none of the subagent's calls
    And the call that spawned it offers a door to 2 calls, as "explore the outline"
    And the call that spawned it is in no lane of its own

  @scratch:chat
  Scenario: Pressing that door opens the agent's own work, drawn as it always was
    # The other half, and the claim that makes the first half honest rather than
    # merely quieter: nothing is thrown away. Behind the door are the very rows
    # that used to be in the column — the same frames, behind the same rail,
    # with the same folds — and only that agent's, which is the thing a wall of
    # interleaved calls could never give you.
    When I ask the agent "subagent"
    And I open the agent's work from the transcript
    Then the agent's work is open, and it is "explore the outline"
    And the agent's work shows 2 calls
    And the agent's work is above the conversation and clear of the box
    And I can close the agent's work

  @scratch:chat
  Scenario: The strip is the other door, and it carries one entry per agent out
    # A fan-out is watched WHILE it runs, and while it runs the spawning row is
    # already scrolling away — so the live door is above the scroll, where the
    # background tasks are and for the same reason. Five agents out is five
    # entries and one shelf: you pick.
    #
    # Asserted while they are still out, which is the only moment this claim is
    # falsifiable.
    When I ask the agent "subagent slow"
    Then the strip lists 1 agents still out
    When I open "read every note" from the strip
    Then the agent's work is open, and it is "read every note"
    # ... and an agent that has been sent out and called nothing yet says so,
    # rather than opening an empty box: its first act is to read its
    # instructions, which produces no frame at all.
    And the agent's work shows nothing yet
    When the agent is released
    Then the strip lists no agent still out
    # THE RECORD DOES NOT GO WITH THE STRIP. The agent has reported back and is
    # off the strip; the shelf it was opened into is still open on it, because
    # a record you could read only while you were too busy to is not a record.
    And the agent's work shows 1 calls

  @scratch:chat
  Scenario: An agent sent MORE WORK is back on the strip, under the same door
    # The bug, seen live (the human, 2026-08-28): an agent authored a PR and
    # reported — its strip entry went quiet, correctly — and was then RESUMED,
    # a follow-up instruction over the same transcript. It worked for twenty
    # minutes and the strip said NOTHING. A running agent with no face anywhere
    # in the panel, which is the one thing this strip exists to make impossible.
    #
    # What the wire does on a resume was measured rather than assumed
    # (`packages/tests/tasks.ts`, against the real adapter): the harness starts
    # that agent's task a SECOND time, and everything the agent does goes on
    # being stamped with the call that SPAWNED it — so olai's patched adapter
    # reopens that very call, and the membership rule that was already there
    # ("spawned, and still running") picks the face back up.
    #
    # ONE AGENT, ONE ROW, ONE DOOR, however many times it goes out: the door's
    # count grows rather than a second door appearing, which is the half a
    # second strip entry would have got wrong while looking right.
    When I ask the agent "subagent slow"
    Then the strip lists 1 agents still out
    When the agent is released
    Then the strip lists no agent still out
    And the call that spawned it offers a door to 1 calls, as "read every note"
    When I ask the agent "subagent again"
    Then the strip lists 1 agents still out
    # ... and it is the same agent, by the name it was sent out with in the turn
    # before — the strip is a tab bar, and an entry that could not be recognised
    # is an entry nobody would press.
    When I open "read every note" from the strip
    Then the agent's work is open, and it is "read every note"
    When the agent is released
    Then the strip lists no agent still out
    # BOTH OUTINGS ARE ONE RECORD. The work of the second is filed under the
    # same row as the work of the first, so the door that was worth opening an
    # hour ago is the door that is worth opening now.
    And the call that spawned it offers a door to 2 calls, as "read every note"
    And the agent's work shows 2 calls

  @scratch:chat
  Scenario: An agent that has been sent out and reported nothing yet still has a face
    # The human's screenshot: a fan-out running, and a panel drawing one
    # pending dot with an ordinary title on it, because every lane above is
    # hung off work a subagent has ALREADY done. A subagent's first act is to
    # read its instructions, which produces no frame at all — so the whole of
    # the stretch anybody watches a fan-out through was the stretch with
    # nothing on screen to say an agent had been started.
    #
    # The spawn's own frame is what says it, and it arrives at the spawn: the
    # adapter stamps `subagent: true` on it, with the kind of agent in the
    # call's arguments. Asserted BEFORE the release, which is the only moment
    # this claim is falsifiable — after it the lane fills and the old panel
    # would look right too.
    When I ask the agent "subagent slow"
    Then the chat says an agent is working, of the kind "Explore"
    # ... and NOTHING else, which is what makes the rail the whole of the claim:
    # there is no call to draw and so no door to offer, and a control opened
    # onto an empty box at the one moment somebody is watching hardest would be
    # worse than the true sentence above it.
    And the call that spawned it offers no door yet
    When the agent is released
    Then the call that spawned it offers a door to 1 calls, as "read every note"
    And the chat says no agent is still working

  @scratch:chat
  Scenario: A face does not outlive the agent that was wearing it
    # The other way a live face goes wrong, and the one a row cannot catch on
    # its own: a status is sticky, an agent that dies mid-spawn reports no
    # completion for the call it was in the middle of, and the rows a dead
    # agent left are deliberately kept on screen to read. So the `Agent` call
    # says `pending` for as long as the panel is open, and a rail that asked
    # the row alone would pulse "working…" under a process that no longer
    # exists.
    #
    # What the row keeps saying is who was sent, because that is a fact about
    # what happened rather than about what is happening.
    When I ask the agent "subagent crash"
    Then the chat says an agent is working, of the kind "Explore"
    When the agent is released
    Then the chat says no agent is still working
    And the chat still shows a call that sent out an "Explore"

  @scratch:chat
  Scenario: A call that keeps running says how long it has been
    # The status mark is the only other thing on that line about time, and it
    # cannot answer this: `·` is what a call announced a quarter of a second ago
    # wears, and `·` is what one that has been grepping for four minutes wears.
    # So the question a person actually has — is this stuck, or is it working? —
    # had no answer anywhere on screen.
    #
    # NOTHING HERE RECOGNISES A TOOL. What earns the number is the status on the
    # wire, which is why a watcher, a build and somebody else's ACP agent all
    # get it for free.
    When I ask the agent "hold"
    Then the chat says how long a running call has been going
    And that elapsed time is ticking
    When the agent is released
    Then the chat times no call

  @scratch:chat
  Scenario: A call one turn gave up on does not start ticking in the next
    # The near-miss this feature had, and the reason the fact is on the ROW.
    # "Is a turn in flight" is a question about the CONVERSATION, and a dead or
    # abandoned call's row is deliberately left where it is — so the next thing
    # anybody sends makes the panel live again and every call the last turn
    # walked away from resumes looking like work in progress, each with a clock
    # counting from its own original stamp.
    #
    # The turn here ends normally and the agent stays alive, which is what makes
    # the second turn possible at all.
    When I ask the agent "abandon"
    Then the chat still shows a call the wire calls "in_progress"
    And the chat times no call
    When I ask the agent "hold"
    # One, and the count is what pins it: the held call is being timed, and the
    # row the previous turn abandoned — still `in_progress`, still on screen — is
    # not.
    Then the chat says how long a running call has been going
    And the chat still shows a call the wire calls "in_progress"
    When the agent is released
    Then the chat times no call

  @scratch:chat
  Scenario: A stopwatch does not outlive the turn it was timing
    # `./spawn.ts`'s failure, arriving at a second face — and worse at this one,
    # because a word that is wrong stays the same size and a number that is
    # wrong grows. A status is sticky, the rows a dead agent left are
    # deliberately still on screen to read, and so a call the agent died in the
    # middle of says `pending` for as long as the panel is open. Asked of the
    # STATUS alone that is a clock counting all afternoon under a process that
    # stopped at lunchtime. The server marks what its turns abandoned, so the
    # row is what says the clock may stop.
    When I ask the agent "subagent crash"
    Then the chat says how long a running call has been going
    When the agent is released
    Then the chat times no call
    # ... while the row itself is untouched: WHO was sent is a fact about what
    # happened, and it does not stop being true when the agent dies.
    And the chat still shows a call that sent out an "Explore"

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
  Scenario: An edit that landed in three places draws all three, and the page survives it
    # The commonest thing a coding agent does, and it took the client down. An
    # `Edit` is reported twice: the announcement's optimistic block, then the
    # adapter's PostToolUse report, which walks `structuredPatch` and sends one
    # `diff` block PER HUNK — every one of them carrying the same path. So three
    # hunks of one file are three rows whose only name is the same name, and the
    # list drawing them keyed on it: the second report handed the framework the
    # same element three times, and its list reconciliation ran off the end of
    # the array it was patching and died reading `remove` of undefined. A page
    # that dies while an agent works takes the whole conversation with it.
    #
    # The count is the other half of the same bug and is why this asserts THREE
    # boxes rather than "it did not break": two rows sharing a name is one of
    # them silently dropped, which is the panel saying a file changed in one
    # place when it changed in two.
    When I ask the agent "hunks"
    Then the chat shows 3 diffs of "notes.md"
    And there should be no page errors

  @scratch:chat
  Scenario: An outline the agent rewrote by hand is still never a text diff
    # The rule is about the FILE, not about the tool that wrote it: a `.olai`
    # is one line per node, so a text diff of one is a single enormous line.
    # olai's own writes cannot produce one — they go through the ops layer —
    # but an agent's own `Edit` can name any file, and one aimed at an outline
    # used to arrive as a diff block and be drawn as ordinary lines.
    When I ask the agent "edit house.olai"
    Then the chat shows the outline "house.olai" changing
    And the outline change says "note rewritten"
    And the chat shows no diff

  @scratch:chat
  Scenario: A long line in a file-edit diff wraps inside the box
    # The 26rem drawer used to keep the line on one row and grow a horizontal
    # scrollbar. The content wraps; the line number and the +/- keep their
    # column — on the addition, the removal, and a wrapping context line.
    # Asked of both the trimmed preview and the expanded view.
    When I ask the agent "edit long.md"
    Then the chat shows a diff of "long.md"
    And the diff is trimmed
    And the diff does not scroll sideways
    And a wrapped diff line keeps its gutter
    When I expand the diff
    Then the diff is expanded
    And the diff does not scroll sideways
    And a wrapped diff line keeps its gutter

  @scratch:chat @phone
  Scenario: A long line wraps on a phone too
    When I ask the agent "edit long.md"
    Then the chat shows a diff of "long.md"
    And the diff does not scroll sideways
    And a wrapped diff line keeps its gutter
    When I expand the diff
    Then the diff is expanded
    And the diff does not scroll sideways
    And a wrapped diff line keeps its gutter

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
    # The other vocabulary, and the rule behind it: a `.olai` diff is one
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
  Scenario: A link the agent wrote opens the page it names, in place
    # THE REGRESSION THIS EXISTS FOR. The panel is mounted BESIDE the panes, so
    # an anchor in a rendered answer had nothing above it to catch the click:
    # a `.md` path the renderer had resolved, and an address of this app the
    # agent spelled out, both fell through to the browser's default and loaded
    # the whole app cold — taking the conversation that was on screen with it.
    When I ask the agent "links"
    Then the agent's answer mentions "the cabinets note"
    When I follow the link "the cabinets note" in the agent's answer
    Then the address is "/notes/cabinets.md"
    # The line that tells a navigation from a load. Without it a full reload
    # passes every other assertion here — it lands on this very document.
    And the page has not reloaded
    # ...which is what the reader would have lost: the transcript is still the
    # one they were reading.
    And the chat shows my message "links"
    # The other half, and a different path through the renderer: an app address
    # in an answer is written as-is and rewritten by nothing.
    When I follow the link "the order row" in the agent's answer
    Then the address is "/#order"
    And the page has not reloaded

  @scratch:chat
  Scenario: Alt+click on a link the agent wrote opens it to the right
    # A written link inside a pane has given this for free since panes existed.
    # The panel asks the router the same question the pane does, so a link in a
    # drawer is not a second kind of link with a shorter list of gestures.
    When I ask the agent "links"
    Then the agent's answer mentions "the cabinets note"
    When I alt-click the link "the cabinets note" in the agent's answer
    Then there are 2 panes
    And pane 1 is showing "/notes/cabinets.md"
    And the page has not reloaded

  @scratch:chat
  Scenario: The input completes the agent's own slash commands
    # The list is the AGENT'S — olai keeps none of its own — so what is offered
    # is whatever that agent reported over the session.
    When I type "/re" into the chat
    Then the completion offers "review"
    When I accept the completion
    Then the chat input reads "/review "

  @scratch:chat
  Scenario: ...and it answers only the keys aimed at the box
    # The list listens on the DOCUMENT, in the capture phase — it has to, so
    # the composer's own Enter cannot send the message somebody was only
    # completing — and that reach was the trouble: it saw every keystroke on
    # the page. With a list up, Enter on the preferences trigger was answered
    # by the COMPLETION: the key was taken and stopped, the box filled itself
    # in, and the panel a person asked for never opened.
    #
    # Being the topmost layer is not the answer to that (`client/topmost.ts`
    # holds the order, and the list is genuinely on it). A list is the panel
    # for the keys aimed at the box it completes, which is what `client/keys.ts`
    # means by its LIST layer — so that is what it now asks first.
    When I type "/re" into the chat
    Then the completion offers "review"
    When I focus the preferences trigger
    And I press Enter
    Then the preferences are open
    And the chat input reads "/re"

  @agent-stored @scratch:chat
  Scenario: A conversation comes back with what was said and what was done
    # WHAT A HISTORY IS, as against a turn. A `session/load` replays a
    # conversation that ended before this process started, so a person's own
    # words arrive as however many chunks the agent kept them in, and the tool
    # calls arrive ALREADY COLLAPSED — one report each, with no announcement in
    # front of them, because there is nothing left to announce. Neither shape
    # occurs in a live turn, which is why the panel could get both wrong with
    # every other scenario here passing.
    #
    # The whole sentence in one bubble is the claim, and it is what the chunks
    # take away: a message drawn as one bubble per chunk is somebody's own words
    # taken apart, in the place a reader looks to remember what they asked.
    Then the chat shows my message "what did we decide?"
    # ... and the call the conversation made, named and finished. A row named
    # after its own call id is a panel that cannot name a history, and a
    # collapsed report is the one frame that has to name a row without an
    # announcement in front of it.
    And the chat shows a completed tool call
    And the chat shows a tool call named "read the notes"

  @agent-stored @scratch:chat
  Scenario: A first boot has nothing to remember, so it takes the newest
    # `session/list` for this directory answers with two, and nothing has ever
    # written down which of them is the panel's — so the most recently updated
    # one is the one it comes up in, replayed, before anybody types. That is a
    # FALLBACK now rather than the rule (see the two scenarios below), and it
    # is still the right answer to a directory this olai has never served.
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

  @agent-stored @scratch:chat
  Scenario: A restart comes back in the conversation the panel was in, not the newest
    # The bug (`chat-restore-wrong`), as the human hit it: the panel was in one
    # conversation, something else in the directory was written to more
    # recently — a terminal `claude`, a `/clear` sibling, an adapter touching a
    # timestamp — and a restart adopted THAT one. Newest-by-`updatedAt` is an
    # answer to "what moved last" standing in for "which one is mine".
    #
    # `an older conversation` is the older of the two by a month, so nothing
    # about a timestamp can bring the panel back to it. Only remembering can.
    When I open the unassigned chats
    And I pick the conversation "an older conversation"
    Then the conversation is titled "an older conversation"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the conversation is titled "an older conversation"

  @agent-stored @scratch:chat
  Scenario: A remembered conversation that is gone falls back to the newest
    # The other half, and the reason the guess is kept rather than deleted: a
    # session can be deleted, cleared out, or belong to an agent this server
    # has been repointed away from. Something has to be opened, and the panel
    # says which conversation it is in either way.
    When I open the unassigned chats
    And I pick the conversation "an older conversation"
    Then the conversation is titled "an older conversation"
    When the conversation "fake-stored-old" is gone from the agent
    And the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the conversation is titled "the last conversation"

  @agent-stored @scratch:chat
  Scenario: A message sent while a conversation is opening does not open a second one
    # THE WINDOW THE REFUSAL FIX OPENED. A conversation is not entered until the
    # agent has agreed to it — which is what stops a refused load leaving the
    # server pointing at one — so between a `session/load` going out and its
    # answer coming back the server is in NO conversation. Anything that booted
    # in that window found nothing open and started opening one, against a load
    # already on the wire.
    #
    # It is not a race anybody has to arrange: the composer is never disabled, a
    # prompt typed while the panel is starting is accepted on purpose, and a
    # load is the one open that takes real time — the agent replays a whole
    # conversation before it answers, which is why it has a deadline of its own.
    #
    # WHAT IT COSTS is the message. The second open goes out behind the first —
    # it asks for the conversation list, which the agent is not going to answer
    # while it is busy with the load — so it sits there until its own boot
    # deadline and the prompt behind it dies with it, in a panel that by then is
    # perfectly healthy and in a conversation. Against an agent that answers
    # both at once it costs more than that: two conversations opened, and the
    # panel in whichever finished last.
    Given the chat eventually shows "we decided to order the cabinets"
    When the next conversation load will hang
    And I open the unassigned chats
    And I pick the conversation "an older conversation"
    And I ask the agent "hello"
    And the agent is released
    # THE CLAIM: the message waited for the conversation and landed IN it.
    # Waiting is the right answer to a send in this window rather than a
    # refusal — there is nothing to tell somebody, because the conversation
    # their message belongs in is the one being opened.
    Then the agent's answer mentions "you said: hello"
    # ... and it is the conversation that was asked for, not one a second open
    # chose out of a note still naming the one being left.
    And the conversation is titled "an older conversation"

  @scratch:chat
  Scenario: An agent that will not open a conversation is not an agent that has gone
    # The panel's THIRD body, and the distinction it exists for. `session/new`
    # is a request like any other, so an agent can answer it with an error and
    # go on running — and reading that as the agent having died left the header
    # saying `not running` about a process that had just spoken, over an empty
    # transcript with a live composer under it inviting a message that had
    # nowhere to go.
    When the agent refuses to new a conversation
    And I start a new conversation
    Then the panel says the conversation could not be opened
    # The reason is the agent's own, because "the conversation could not be
    # opened" is the sentence every one of these shares and the one that never
    # helped anybody.
    And the refusal is in the agent's own words, "will not start a conversation"
    # THE CLAIM: the agent is still there. The header goes on naming the model
    # rather than reporting a death, and the box is gone because there is
    # nothing to send to — not because sending is switched off.
    And the panel header names the model "Fake One"
    And there is nothing to type into
    # ... and the one thing that can change it does, once the agent relents.
    When the agent will new a conversation again
    And I try to open it again
    Then the panel shows no such refusal
    And the agent is idle
    When I ask the agent "hello"
    Then the agent's answer mentions "you said: hello"

  @agent-stored @scratch:chat
  Scenario: A boot whose conversation is refused says so, and can still be got out of
    # THE OTHER PLACE a conversation is opened, and the one no click can reach:
    # a server starting. Boot adopts a stored conversation and asks for it, and
    # an agent that says no there used to leave the panel reporting a dead
    # process.
    When I open the unassigned chats
    And I pick the conversation "an older conversation"
    Then the conversation is titled "an older conversation"
    When the agent refuses to load a conversation
    And the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "no such conversation"
    And there is nothing to type into
    # THE MODULE IS NOT IN IT, and trying again is what proves that: entering a
    # conversation is what this server records being IN one, and a boot that
    # recorded it BEFORE asking left every later verb — this retry included —
    # believing there was a conversation already. A retry answered by doing
    # nothing at all is what that looked like.
    When the agent will load a conversation again
    # ...and it dawdles, so the retry is IN FLIGHT while the next thing happens.
    And the next conversation load will hang
    And I try to open it again
    # A SECOND PRESS FINDS NOTHING WAITING. Reading the attempt and taking it
    # are one step, so whichever press gets there first leaves with it — and
    # for a refused `+ new` two presses that both left with it would be a
    # second fresh conversation wiping the first. The refusal is drawn in this
    # body because the click was made in it: there is no transcript here to put
    # it in, and a control that can be refused silently is the one thing
    # nothing in this panel may be.
    And I try to open it again
    Then the chat says the click was refused, with "no conversation is waiting to be opened"
    When the agent is released
    Then the panel shows no such refusal
    And the conversation is titled "an older conversation"
    And the agent is idle

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
    And I open the unassigned chats
    # NAMED, and named as ONE AGENT's trouble rather than as the list failing:
    # the list spans every installed agent now, so "we could not find out" is a
    # fact about a row of the roster. Here there is only one row, so it is the
    # whole of what there was to say.
    Then the list says "claude" could not be asked, with "the conversation store is unreadable"
    And the unassigned list is empty

  @agent-stored @scratch:chat
  Scenario: The picker switches conversations
    When I open the unassigned chats
    Then the unassigned list lists "an older conversation"
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
  Scenario: The header says how full the context is, and follows it across turns
    # `chat-token-usage`. Nothing on screen used to say how much room was left,
    # so the way a person found out it was time to `/compact` was by watching
    # the agent start forgetting. The agent has been sending it all along —
    # ACP's own `usage_update`, several frames a turn.
    Then the panel header says nothing about the context
    When I ask the agent "hello"
    Then the agent is idle
    # 12,900 after one turn, and NOT the 12,000 of that turn's first frame: the
    # panel holds the newest report rather than the first.
    And the panel header says the context is "13k/200k"
    When I ask the agent "hello again"
    Then the agent is idle
    And the panel header says the context is "26k/200k"

  @scratch:chat
  Scenario: The context window itself can move, and the header follows that too
    # Both halves of the fraction are the agent's to revise. The real adapter
    # seeds the window from what it last learned for the model and corrects it
    # authoritatively at the end of a turn, so the first turn after a `/model`
    # can report the previous model's window and then the true one. A percentage
    # would have hidden this entirely — 6% of 200k and 6% of 1M are the same
    # number and quite different amounts of work left.
    When I ask the agent "hello"
    Then the panel header says the context is "13k/200k"
    # HELD between the turn's two usage frames, so the mid-stream state is
    # looked at rather than inferred from where the turn ended. Inferring it
    # would pin nothing about the ORDER: an agent that moved the window before
    # both frames ends in the same place.
    When I ask the agent "window 1000000 hold"
    Then the agent is working
    # Mid-turn: the window the conversation began on, and this turn's first
    # count of what it has spent.
    And the panel header says the context is "25k/200k"
    When the agent is released
    Then the agent is idle
    # ... and the correction lands on the turn's last frame, which is where the
    # adapter puts it. A panel that kept the turn's FIRST report would still be
    # showing the line above.
    And the panel header says the context is "26k/1M"

  @scratch:chat
  Scenario: A new conversation is not asked how full the last one was
    # The number goes with the context it was about. Leaving it up across a
    # session change would be the panel answering "should I compact?" about a
    # conversation that no longer exists.
    When I ask the agent "hello"
    Then the panel header says the context is "13k/200k"
    When I start a new conversation
    Then the agent is idle
    And the panel header says nothing about the context

  @scratch:chat
  Scenario: The header follows the model the agent is actually running
    # Two sources: the session's config option is what was PICKED, and the
    # CLI's own init message is what is RUNNING. A `/model` is handled inside
    # the wrapped CLI, so the picker never hears about it — a header reading
    # only the picker names the model the session STARTED on, forever.
    Then the panel header names the model "Fake One"
    When I ask the agent "model fake-model-2"
    Then the agent is idle
    # ONE TURN LATE, and the lag is the adapter's floor rather than a bug in
    # the panel: the `init` for a turn is emitted as that turn STARTS, so the
    # turn that ran `/model` announced the model it began on and nothing else
    # in it carries the new one. Asserted after the turn is over, when the
    # header has everything it is ever going to get about that turn.
    And the panel header names the model "Fake One"
    When I ask the agent "hello"
    Then the panel header names the model "Fake Two"

  @scratch:chat
  Scenario: A running model is named the way the picker names it, not as a raw id
    # The bug the header was filed for, and the half of it that was silent. The
    # adapter's picker offers ALIASES — `sonnet`, `haiku`, `opus[1m]` — while
    # the model the CLI reports running is a concrete API id. So the two never
    # matched, and the one thing the header could say about a model somebody
    # had just switched to was `claude-sonnet-5`, in a panel whose picker calls
    # that same model "Sonnet".
    Then the panel header names the model "Fake One"
    When I ask the agent "model claude-sonnet-5"
    And I ask the agent "hello"
    Then the panel header names the model "Fake Sonnet"

  @scratch:chat
  Scenario: A model the picker cannot name without inventing is named as its raw id
    # The negative twin of the scenario above, and the case a review constructed
    # against the real adapter. A live id states no context lane, so a picker row
    # that states one may not answer for it: naming "Fake Opus (1M context)" over
    # a session running 200k is a lie about the number a person reads this line
    # to decide `/compact` by. The id claims nothing, which is the truth here.
    When I ask the agent "model claude-opus-5"
    And I ask the agent "hello"
    Then the panel header names the model "claude-opus-5"
    # And the same refusal for a DATED pin, which names something more specific
    # than any family alias covers — `haiku` is on offer and does not answer.
    When I ask the agent "model claude-haiku-4-5-20251001"
    And I ask the agent "hello"
    Then the panel header names the model "claude-haiku-4-5-20251001"
    # ... while the undated one it is a pin of resolves, so the refusal above is
    # the rule doing its job rather than the alias row being unreachable.
    When I ask the agent "model claude-haiku-4-5"
    And I ask the agent "hello"
    Then the panel header names the model "Fake Haiku"

  @scratch:chat
  Scenario: The picker repeating itself does not undo a model the CLI reported
    # A `config_option_update` carries the WHOLE set, so anything else moving in
    # it — a mode, an effort level — re-sends a model row still naming what the
    # session started on. That frame arriving after a `/model` must not walk the
    # header back to it. Each source is debounced against its own previous
    # value, which is what makes a source repeating itself not a source moving.
    When I ask the agent "model claude-sonnet-5"
    And I ask the agent "hello"
    Then the panel header names the model "Fake Sonnet"
    When I ask the agent "reconfig"
    Then the agent is idle
    And the panel header names the model "Fake Sonnet"

  @agent-stored @scratch:chat
  Scenario: A model the conversation was switched to survives a restart
    # The bug (`chat-model-reverts-on-restart`), as the human hit it: switch the
    # chat to another model, redeploy olai, and the conversation comes back on
    # the one the container's `settings.json` pins. That pin is the agent's own
    # answer at every boot — this agent gives the same one, its picker naming
    # `fake-model-1` on every `session/load` however the last turn ended — and a
    # panel that only ever READ what it was told had nothing to say back.
    #
    # So the panel writes down the model this conversation is running and puts
    # it back after the load, through the config option the picker is.
    #
    # SWITCHED TO AN API ID, which is the vocabulary this actually happens in:
    # the CLI reports `claude-sonnet-5` where the picker offers `sonnet`, so
    # what the panel writes down is a word the picker never offered — and the
    # request that puts it back has to be made in the picker's own words. This
    # agent refuses anything else, exactly as an agent reading its own list
    # would.
    When I ask the agent "model claude-sonnet-5"
    And I ask the agent "hello"
    Then the panel header names the model "Fake Sonnet"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the conversation is titled "the last conversation"
    And the panel header names the model "Fake Sonnet"
    # ... and it is the AGENT that is on it, not a label the panel drew from its
    # own note: the next turn's `init` says what the CLI is actually running, so
    # a re-assert that never reached the agent walks the header back to the pin.
    When I ask the agent "hello"
    Then the panel header names the model "Fake Sonnet"

  @agent-stored @scratch:chat
  Scenario: A conversation nobody switched follows the machine's default, and is not pinned to it
    # The other side of the rule, and the one that keeps this feature from
    # becoming a pin on everything it touches: what a source says FIRST is what
    # the agent decided, not a choice somebody made, so it is never written
    # down. A conversation that ran `Fake One` because that is what this
    # machine pins must move when the machine's pin moves — and it can only do
    # that if nothing was remembered about it.
    #
    # A turn first, so the CLI has reported a running model at least once: that
    # report is exactly the value a panel writing down its first hearing would
    # come back and re-assert.
    Then the panel header names the model "Fake One"
    When I ask the agent "hello"
    Then the panel header names the model "Fake One"
    # The container is redeployed with a different model in its settings.
    When the agent's pinned model becomes "fake-model-2"
    And the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the conversation is titled "the last conversation"
    And the panel header names the model "Fake Two"
    # ... and nothing was said back to the agent about it, because there was
    # nothing to say: no request, so no refusal either.
    And the chat says nothing went wrong

  @agent-stored @scratch:chat
  Scenario: A model that cannot be put back says so, and is still tried at the next restart
    # The refusal path, which the panel promises three things about: a row
    # where a person is looking, a header that goes on naming what the agent
    # actually said, and a memory left ALONE — so the next boot tries again
    # rather than quietly adopting the pin as the answer.
    #
    # `claude-opus-5` is the model this picker cannot name without inventing a
    # context window (the scenario above this one), so nothing translates it
    # into a row and the request goes out in the words the CLI used — which
    # this agent refuses, exactly as an agent reading its own list would.
    When I ask the agent "model claude-opus-5"
    And I ask the agent "hello"
    Then the panel header names the model "claude-opus-5"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the conversation is titled "the last conversation"
    And the chat eventually shows "could not be put back"
    # The agent's own answer, still named — the conversation is open and usable
    # on the model the pin gave it, which is where it was before any of this.
    And the panel header names the model "Fake One"
    # ... and the note was not overwritten by the model we failed to leave, so
    # the next boot asks again rather than treating the pin as settled.
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the chat eventually shows "could not be put back"

  @scratch:chat
  Scenario: A message sent mid-turn WAITS ITS TURN, and the row says so
    # FOUR arrangements, and this is the fourth. The box used to be turned OFF
    # while the agent worked; then a send was accepted and QUEUED HERE, which
    # held the message out of sight until the turn was over and dropped it on
    # the next cancel, destroying words nobody had a copy of; then every
    # mid-turn send STEERED, which delivered the words at once and tore down
    # whatever the turn was doing to make room for them. Now a send is one verb:
    # it goes to the agent as it is typed, and the AGENT holds it behind the
    # turn it is working on.
    #
    # The queue that was deleted is still deleted. What is different is whose
    # queue it is and that a person can see their message in it.
    When I ask the agent "hold"
    Then the agent is working
    And the chat input takes typing
    # ... and the composer promises, before anything is pressed, what pressing
    # send will do — on an agent that said it holds what it is sent.
    And the composer says a message would queue
    When I ask the agent "done order"
    Then the chat input still has the caret
    # It is a row the moment it is sent, like every other message.
    And the chat eventually shows "done order"
    # THE CLAIM, and it is the `/compact` bug stated in miniature: the running
    # turn is UNTOUCHED. Nothing was injected into it, nothing was pre-empted,
    # and the node has not moved — the words are at the agent, waiting, which is
    # what the row says.
    And node "order" is not done
    And the chat shows my message "done order" as waiting
    And the agent is working
    # ... and when the turn in front of it ends, the agent takes it up: the hint
    # comes off and the work happens. In that order and by itself — nothing here
    # re-sent anything.
    When the agent is released
    Then my message "done order" is no longer waiting
    And node "order" is done
    And the agent is idle

  @scratch:chat
  Scenario: The interrupting gesture puts a message INTO the running turn
    # The other half, and the whole reason steering still exists: a person who
    # can see the agent is halfway through the wrong thing wants it to hear them
    # NOW, and "not that file, the other one" is worth saying at the moment you
    # notice. That moment is almost never the moment the agent stops.
    #
    # It is a SECOND gesture rather than what enter does, because it costs
    # something: pre-empting a turn tears down what it was doing. So the panel
    # asks for it to be meant — a button of its own, and Alt+Enter for a hand
    # already on the keyboard.
    When I ask the agent "hold"
    Then the agent is working
    And the composer offers an interruption
    When I interrupt the agent with "done order"
    # THE CLAIM: the node moves while the first turn is STILL RUNNING. Nothing
    # has been released and nothing has ended — a message that waited its turn
    # could not have done this, and that is the whole difference between the two
    # gestures.
    Then node "order" is done
    And the agent is working
    # ... and it is not waiting for anything: it is IN the turn, so there is no
    # queue it could be in and nothing on the row to say there is.
    And my message "done order" is no longer waiting
    When the agent is released
    Then the agent is idle

  @scratch:chat
  Scenario: Once this conversation has queued, the interruption is withdrawn
    # A GUARD AROUND SOMEBODY ELSE'S DEFECT, and the one thing in this feature
    # that is not a rule of olai's own. The pinned adapter leaves a turn's
    # `session/prompt` unanswered forever if a steer is injected into any turn
    # of a session that has ever held a QUEUED one — the steered words run and
    # stream, and only a cancel ends the turn. Reproduced on the wire with no
    # olai in it; before this feature it was unreachable, because nothing ever
    # sent a mid-turn prompt on this leg. Which pins that has been measured
    # against, and the second trigger this latch does NOT cover, are in
    # `acp/patches/README.md` — named here rather than restated, because a
    # version number in a scenario is one more copy to re-check per bump.
    #
    # So the panel stops offering what it cannot make end. The cost is real and
    # is the ruling: after one message typed during a turn, this conversation
    # has no interruption for the rest of its life. The scripted agent has no
    # such defect — what is pinned here is the GUARD, which is olai's.
    When I ask the agent "hold"
    Then the agent is working
    And the composer offers an interruption
    When I ask the agent "hello"
    Then the chat shows my message "hello" as waiting
    # THE CLAIM: the control is gone the moment a message takes its place in
    # the agent's queue, not when the turn ends.
    And the composer offers no interruption
    When the agent is released
    Then the agent is idle
    # ... and it stays gone, because what poisoned it was the SESSION.
    When I ask the agent "hold"
    Then the agent is working
    And the composer offers no interruption
    # ... and the keyboard door is shut with it: Alt+Enter is an ordinary send
    # here, so the node does NOT move while the first turn is still running.
    When I interrupt the agent with "done order" by keyboard
    Then the chat shows my message "done order" as waiting
    And node "order" is not done
    When the agent is released
    Then node "order" is done
    And the agent is idle
    # A NEW CONVERSATION is a new session, and the defect is per session — so
    # the gesture comes back rather than being lost for the life of the panel.
    When I start a new conversation
    Then the chat is empty
    When I ask the agent "hold"
    Then the agent is working
    And the composer offers an interruption
    When the agent is released
    Then the agent is idle

  @scratch:chat
  Scenario: Alt+Enter is the same gesture as the button
    # A chord nobody can see is a feature only its author knows about; a button
    # that did something the keyboard could not is the same complaint from the
    # other side. One gesture, two doors — the arrangement the `/` command list
    # already has.
    When I ask the agent "hold"
    Then the agent is working
    When I interrupt the agent with "done order" by keyboard
    Then node "order" is done
    And the agent is working
    When the agent is released
    Then the agent is idle

  @scratch:chat
  Scenario: An agent that advertises nothing is offered nothing, and still works
    # The losing direction, chosen and walked. Whether a person is OFFERED an
    # interruption is read off what the agent said about itself at the
    # handshake — a control drawn for an extension nobody claimed is a control
    # that refuses when pressed, and a promise made for an agent that never said
    # it queues is olai speaking for somebody else.
    #
    # And what it costs is nothing that matters: the send is the send it always
    # was, the row says it is waiting because that is olai's own fact about its
    # own turns, and the agent gets to it.
    When the agent advertises nothing about itself
    And the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    And I ask the agent "hold"
    Then the agent is working
    And the composer offers no interruption
    And the composer says nothing about queueing
    When I ask the agent "done order"
    Then the chat shows my message "done order" as waiting
    When the agent is released
    Then node "order" is done
    And the agent is idle

  @scratch:chat
  Scenario: An agent with NO queue refuses the busy send, and the words stay
    # THE THIRD LEG OF THE WORLD. Both agents olai ships against hold a
    # mid-turn prompt — one advertises it, one was verified — so "what does a
    # send while busy do on an agent that neither queues nor advertises" was
    # reasoned about and never driven. An older adapter is exactly that: it
    # answers the concurrent `session/prompt` with an error.
    #
    # There is nothing special about it, and that is the claim. It is an
    # ordinary turn failure: the words stay in the bubble they were typed into,
    # marked, with one press to send them again — the same face a refused
    # interruption wears, reached down the other lane.
    When I ask the agent "refuse busy"
    Then the agent is idle
    When I ask the agent "hold"
    Then the agent is working
    When I ask the agent "done order"
    Then the chat shows my message "done order" as "refused"
    And the strip under my message "done order" reads "not sent"
    # ... and the row does not claim two things at once: a message that was
    # refused is not also one waiting its turn.
    And my message "done order" is no longer waiting
    And node "order" is not done
    # The turn in flight is untouched by the refusal — it was never reached.
    And the agent is working
    When the agent is released
    Then the agent is idle
    # ... and the same row's own words go once there is a turn to start.
    When I send the undelivered message again
    Then node "order" is done
    And no message is marked undelivered

  @scratch:chat
  Scenario: A queued message still says so in a tab that has just arrived
    # The hint is a field on the row the SERVER wrote, not a note this tab
    # keeps — so a reload mid-queue is seeded from the same transcript, and a
    # second tab joining sees what the first one sees. Worth driving rather
    # than reasoning about: a hint that lived in the browser would survive
    # every assertion above this one and vanish here, which is the moment a
    # person actually reaches for a reload.
    When I ask the agent "hold"
    Then the agent is working
    When I ask the agent "done order"
    Then the chat shows my message "done order" as waiting
    When I open the app
    # ... and NOT `the agent panel is open`, which waits for the panel to
    # SETTLE (idle, or off with no agent) — a turn held open is the whole point
    # of this scenario, so that step would wait out the hold and photograph a
    # conversation that had finished. The panel comes back open by itself: that
    # is remembered per browser, and the row below is what proves it drew.
    #
    # THE CLAIM: the fresh tab's first frame carries the hint, and the turn in
    # front is still running under it.
    Then the chat shows my message "done order" as waiting
    And the agent is working
    # ... and the clearing arrives on the same wire the snapshot came from.
    When the agent is released
    Then my message "done order" is no longer waiting
    And node "order" is done
    And the agent is idle

  @scratch:chat
  Scenario: Cancel stops the turn, and the message waiting behind it still runs
    # #194's ruling, kept word for word: cancel means stop the agent and nothing
    # else. What changed under it is that there is something behind the turn
    # again — and it is the AGENT'S queue, not this panel's, so a cancel has no
    # array to empty and nobody's words to throw away. That was the whole sin of
    # the queue that got deleted, and it is not reachable from here.
    # `slow` rather than `hold` because this turn has to STOP when it is told
    # to, which is the thing being cancelled; `hold` waits for a scenario to
    # release it and would outlive the press.
    When I ask the agent "slow"
    Then the agent is working
    When I ask the agent "done order"
    Then the chat shows my message "done order" as waiting
    When I cancel the turn
    # The turn stops and says so, once — one press, one notice, however many
    # messages were behind it. The agent answers `cancelled` for every turn it
    # had in flight, this one's queue included, and in whatever order it likes:
    # a person who pressed one button is told one thing.
    Then the chat says the turn was cancelled
    And the chat says it once
    # THE CLAIM: the words survived. They were never here to be dropped, and the
    # agent runs them next, in order.
    And node "order" is done
    And my message "done order" is no longer waiting
    # ... and nothing is marked undelivered: nothing failed to be delivered.
    And no message is marked undelivered

  @scratch:chat
  Scenario: A message the agent REFUSED stays on screen, and can be sent again
    # The one way a send can still fail against a live agent: it was an
    # INTERRUPTION, and the agent that advertised one refuses it. The
    # advertisement is what drew the button; the request is what proves what it
    # does, which is why both exist. The words do NOT go into a queue and they
    # do not go anywhere — they stay in the conversation, in the bubble they
    # were typed into, marked as not sent, with one press to try again. A person
    # never has to wonder whether a sentence they typed still exists.
    #
    # THE FIRST OF TWO FACES. This one is a certainty: the agent ANSWERED the
    # steer with an error, so nothing took the message and the button under it
    # is an honest offer. The other face is the scenario below.
    When I ask the agent "refuse steering"
    Then the agent is idle
    When I ask the agent "hold"
    Then the agent is working
    When I interrupt the agent with "done order"
    Then the chat shows my message "done order" as "refused"
    # ... in the words a person reads, not only in the attribute the panel
    # carries. Swapping the two faces' sentences left this suite green until
    # both reviewers said so.
    And the strip under my message "done order" reads "not sent"
    # ... and it really did not go: nothing marked anything.
    And node "order" is not done
    # SEND AGAIN IS A SEND, never a second interruption: a person pressing it
    # is asking for their message to go, not for the turn to be broken into
    # again — and it goes, at once, to wait its turn like any other. So the
    # mark comes off (a row must not go on advertising a failure that has
    # stopped being true) and the row says what is true instead: it is waiting.
    When I send the undelivered message again
    Then no message is marked undelivered
    And the chat shows my message "done order" as waiting
    And node "order" is not done
    # ... and the agent gets to it when the turn in front of it ends.
    When the agent is released
    Then node "order" is done
    And my message "done order" is no longer waiting
    And the agent is idle

  @scratch:chat
  Scenario: A message the agent never ANSWERED says so, and offers no retry
    # THE SECOND FACE, and the whole reason the two are told apart. `swallow
    # steering` takes the message and never answers: the agent is alive,
    # reading, streaming its turn — and from this end there is no way to know
    # whether those words landed in it. An agent that took the message and then
    # went quiet is indistinguishable from one that never took it.
    #
    # So the panel says exactly that, and offers NOTHING to press. A retry here
    # would hand somebody a duplicate they had no way to predict — which is the
    # bug this scenario exists for: both faces used to read "not sent", with the
    # same button under them.
    When I ask the agent "swallow steering"
    Then the agent is idle
    When I ask the agent "hold"
    Then the agent is working
    When I interrupt the agent with "done order"
    # The only thing that can end a steer nobody answers is the client's own
    # deadline, so this step — and this step alone in the suite — waits it out.
    Then the chat eventually shows my message "done order" as "unanswered"
    # The words are still in the bubble they were typed into. What is missing is
    # the certainty, not the message.
    And the chat shows my message "done order"
    And the strip under my message "done order" reads "no answer — it may not have arrived"
    And the chat offers no way to send it again
    # ... and the transcript keeps the reason, rather than only the banner that
    # the next turn will clear.
    And the chat eventually shows "did not answer"
    When the agent is released
    Then the agent is idle

  @scratch:chat
  Scenario: A turn that died having said NOTHING marks the message that started it
    # The OTHER delivery lane, and the gate inside it. A prompt is a delivery
    # like a steer is: a turn that produced not one frame leaves this end unable
    # to tell a prompt that was read from one that never arrived, and the words
    # deserve the same account of themselves. `vanish` is exactly that — the
    # agent falls over before even the usage frames every turn opens with.
    When I ask the agent "vanish"
    Then the chat eventually shows "the agent exited"
    And the chat shows my message "vanish" as "unanswered"
    And the strip under my message "vanish" reads "no answer — it may not have arrived"
    # No button, for the reason the whole feature exists: the agent may have
    # read those words before it died, and nobody can say.
    And the chat offers no way to send it again

  @scratch:chat
  Scenario: A turn that SPOKE before it died leaves the message alone
    # The other side of that gate, and the regression it exists to stop: an
    # inverted reading would put "not sent" and a `send again` under a prompt
    # the agent demonstrably worked on, which is an offer to send it twice to
    # somebody with no way to tell. `crash` speaks first and then falls over.
    When I ask the agent "crash"
    Then the agent's answer mentions "about to fall over"
    And the chat eventually shows "the agent exited"
    # The words are on screen, as they always are — with no mark and no button,
    # because there is nothing undelivered about them.
    And the chat shows my message "crash"
    And no message is marked undelivered

  @scratch:chat
  Scenario: A turn the agent REFUSED ends the turn, not the conversation
    # `session/prompt` is a request like any other, so a JSON-RPC error is an
    # answer it can have — a mode the agent cannot prompt from, a session it has
    # lost track of, a model it could not reach. Nothing died and nothing is
    # unreachable: ONE turn failed, and the conversation under it is exactly as
    # usable as it was.
    #
    # It used to be read as the agent having gone. The panel then said `not
    # running` about a process that was running, in a conversation it was still
    # in, for the rest of the session — and the only thing that took the word
    # back was another turn succeeding.
    When I ask the agent "error"
    Then the chat eventually shows "this turn cannot be run in the mode"
    # THE CLAIM: still there. Idle rather than gone, and the box still takes
    # what somebody types into it.
    And the agent is idle
    And the chat input takes typing
    # The turn ended honestly on the way: the message did not land, because an
    # error response is JSON-RPC saying the request took no effect, so the row
    # keeps the words and offers to send them again.
    And the chat shows my message "error" as "refused"
    # ... and the next prompt goes to the same live agent.
    When I ask the agent "hello"
    Then the agent's answer mentions "you said: hello"
    And the agent is idle
    And the chat says nothing went wrong

  @scratch:chat
  Scenario: Cancelling under a message in flight does not start the turn back up
    # Both buttons are on screen at once, which is what this feature sells — so
    # saying the next thing and then deciding the whole turn was wrong is a
    # coherent pair of presses, and the second one has to win.
    #
    # The ordering nobody could see before: the steer is on the wire when the
    # cancel lands, so the agent answers "nothing to steer" — the SAME answer a
    # turn that simply finished gives. Read as that, the message becomes an
    # ordinary prompt and the panel starts a fresh turn the person just pressed
    # a button to end. The ticket the steer was aimed at is what tells the two
    # apart, and `slow steering` is what makes cancel win the race every time.
    When I ask the agent "slow steering"
    Then the agent is idle
    When I ask the agent "slow"
    Then the agent is working
    When I interrupt the agent with "done order"
    And I cancel the turn
    # The steer answers a moment later, and the row is what it lands on: the
    # words are kept and offered back, never re-sent on somebody's behalf. It
    # is a REFUSAL: the agent answered, and what it answered was that there was
    # nothing to steer, so nothing took the message.
    Then the chat shows my message "done order" as "refused"
    # THE CLAIM: still idle. A `begin` here would read as the cancel undoing
    # itself, which is the whole bug.
    And the agent is idle
    And node "order" is not done

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
  Scenario: Opening a conversation with a transcript lands on the newest line
    # A different question from the one above. Following is a decision the
    # reader makes by scrolling WHILE they are in a conversation. Opening one
    # — the panel coming back, a stored chat picked from the list — is always
    # a jump to the newest line, even if they had scrolled away before they
    # left. The jump is instant: an open is a place, not a motion.
    When I ask the agent "flood"
    Then the agent is idle
    And the transcript is scrolled to the newest line
    When I scroll the transcript to the top
    And I close the agent panel
    And I open the agent panel again
    Then the chat eventually shows "line 39"
    And the transcript is scrolled to the newest line

  @agent-stored @scratch:chat
  Scenario: Picking a stored conversation lands on the newest line
    # Same claim, other door: the panel stays mounted and the conversation
    # identity changes. A scroll-away in this one must not leave the next one
    # stuck at the top. `an older conversation` replays enough lines that the
    # pane has a bottom to be at.
    When I ask the agent "flood"
    Then the agent is idle
    And the transcript is scrolled to the newest line
    When I scroll the transcript to the top
    And I open the unassigned chats
    And I pick the conversation "an older conversation"
    Then the conversation is titled "an older conversation"
    And the chat eventually shows "line 39"
    And the transcript is scrolled to the newest line

  @agent-stored @scratch:chat
  Scenario: Growth after opening still lands on the newest line
    # The open-jump can pass while the pane is still growing — a restored
    # conversation's markdown lands after the first paint, and a late row is
    # the same shape. The first assertion is the open; the second is growth
    # that arrives after that assertion has already passed. If following
    # were stamped false by the jump's own late `scroll` event, the late
    # line would leave the reader short of the newest. Armed and released
    # rather than slept, so the two moments are steps, not a race.
    When I arm late growth on the next stored conversation
    And I open the unassigned chats
    And I pick the conversation "an older conversation"
    Then the conversation is titled "an older conversation"
    And the chat eventually shows "line 39"
    And the transcript is scrolled to the newest line
    And the chat does not yet show "late line"
    When the agent is released
    Then the chat eventually shows "late line"
    And the transcript is scrolled to the newest line

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
  Scenario: A permission a subagent asked for says which subagent is asking
    # The form was drawn in the main column and read as the agent you are
    # talking to — anonymous at the one row where who is asking decides what
    # you press. And the row broke the RUN under it: a form in no lane between
    # two of one subagent's calls ends the stretch, so the lane re-opened and
    # introduced itself again underneath the form, and one agent read as two.
    #
    # The attribution rides the request itself here, beside the tool name the
    # rule about approving-without-asking already reads.
    When I ask the agent "subagent asks"
    Then the chat shows a question
    And the question is drawn in the lane of the agent that asked it
    And the question's lane names itself, as "explore the outline"
    # THE CONSTRAINT THIS SCENARIO NOW ALSO CARRIES, and the sharper half of it.
    # A subagent's calls are filed under that agent and read through a door —
    # and a QUESTION is the one row deliberately exempt from that. It is not the
    # subagent talking: it is a question to the reader, it blocks the turn, and
    # a form behind a click is a turn that hangs forever. So the form is HERE,
    # in the conversation, in the very turn whose calls are not.
    And the conversation carries none of the subagent's calls
    When I choose "Allow Once"
    And I answer the question
    Then the agent's answer mentions "permission: allow"
    And the question is drawn in the lane of the agent that asked it
    And exactly one lane names itself, as "explore the outline"
    And no lane introduces itself under the question

  @scratch:chat
  Scenario: A shelf open over a question says so, because the form is not in it
    # `docs/chat.md`'s promise, and the one place this feature could have broken
    # it: with the conversation in front of you, a form ARRIVING IS THE WHOLE OF
    # IT — it lands where you are already looking, the composer says so, and
    # nothing rings, because a notification about something on your screen is
    # nagging.
    #
    # A shelf is the one surface that takes a reader's eye off the transcript
    # while the panel still counts as open. The form is deliberately not copied
    # into it — one decision drawn as two forms is one of them pressed by
    # somebody who cannot see the other — so what the reader would have got is a
    # gap in the calls and a form in a pane that has just been made smaller. The
    # shelf therefore carries the sentence itself, and pressing it puts the
    # shelf away and goes to the form: the same ask the alert banner raises, so
    # there is one gesture and still exactly one form.
    When I ask the agent "subagent asks"
    Then the chat shows a question
    When I open "explore the outline" from the strip
    Then the agent's work says a question is waiting
    When I go to the question from the agent's work
    Then no agent's work is open
    And the chat shows a question
    And the question is drawn in the lane of the agent that asked it
    When I choose "Allow Once"
    And I answer the question
    Then the agent's answer mentions "permission: allow"

  @scratch:chat
  Scenario: A question a subagent asked is drawn in the subagent's lane too
    # The OTHER shape, and it is not the one above with a different payload:
    # an `elicitation/create` carries no attribution at all. It names the tool
    # call it was asked from, and that call's own announcement is where the
    # adapter said whose it was — so this is the path where the answer is
    # remembered from a frame rather than read off the request.
    When I ask the agent "subagent elicits"
    Then the chat shows a question
    And the question is drawn in the lane of the agent that asked it
    And the question's lane names itself, as "explore the outline"
    # ... and here too, on the path where the attribution is remembered rather
    # than read: the calls are behind the door and the form is not.
    And the conversation carries none of the subagent's calls
    When I choose "oak"
    And I answer the question
    Then the agent's answer mentions "oak"
    And exactly one lane names itself, as "explore the outline"
    And no lane introduces itself under the question

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
  Scenario: The camera is offered only where a finger is the pointer
    # The `+`'s second door is a phone's, and a desktop — which is what this
    # browser is — gets NO button for it: on a fine pointer the `capture`
    # attribute is ignored, so the same markup would answer with an ordinary
    # file dialog, and a camera button that opens a file dialog is a button
    # that lies (web/src/client/chat/camera.ts). What must survive there is
    # the roll's reach: one tap, the same picker as ever.
    Then the composer is not offering a camera
    When I pick "shot.png" with the attach button
    Then the composer is holding the picture "shot.png"

  @scratch:chat @phone
  Scenario: Photos shot straight into the chat all ride one message
    # The human's ask, verbatim: outside with only the phone, wanting to take
    # photos into the chat. One invocation of a camera is ONE photo, so the
    # strip is what makes it several — shoot → chip → shoot again — and the
    # taps are the same two taps every time, with the `+` beside it exactly
    # as reachable as it always was.
    #
    # The same photo TWICE is two attachments — what the chips pin here is
    # the SERVER's answer to a name it has already stored (`porch-1.jpg`)
    # and the strip keeping the order the shots were taken in. What they do
    # NOT pin is the cleared input underneath: this harness injects files
    # and fires `change` unconditionally, so an uncleared shutter would pass
    # unnoticed — which is why the step itself reads the shutter's value
    # back after every shot instead of leaving that to the chip count.
    When I take a photo called "porch.jpg" with the camera
    Then the composer is holding the picture "porch.jpg"
    When I take a photo called "porch.jpg" with the camera
    Then the composer is holding "porch.jpg, porch-1.jpg" in that order
    When I take a photo called "door.jpg" with the camera
    Then the composer is holding "porch.jpg, porch-1.jpg, door.jpg" in that order
    When I ask the agent "what are these"
    Then the agent read "porch.jpg, porch-1.jpg, door.jpg" in that order

  @scratch:chat @phone
  Scenario: A dismissed capture touches nothing — not even somebody else's refusal
    # The guard in the composer's `picked` exists for exactly this: the
    # camera answered with NOTHING — backed out of, permission refused; from
    # this side the empty FileList is one shape — and the box must be
    # exactly as it was. "Exactly" is the load-bearing word: the unguarded
    # path reached `holding.take([])`, whose housekeeping CLEARS the refusal
    # line — so a dismissal used to erase the record of a drop the app had
    # just said no to. The refusal is earned first precisely so the last
    # line has something to lose.
    When I drop "whatever.zip" on the chat panel
    Then the chat eventually shows "cannot be attached"
    And the chat eventually shows "whatever.zip"
    When I dismiss the camera
    Then the composer is holding nothing
    And the chat still shows "cannot be attached"

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

  @scratch:chat
  Scenario: A background task the agent armed is visible from where the reader is, and so is its death
    # The incident this is about: an orchestrator armed
    # `kolu watch --states waiting,awaiting --nag 10m` as a persistent Monitor
    # and supervised a whole dispatch off its events — and the panel showed
    # none of it. No arming, no liveness, no death. The human had to ask "how
    # do you know you are babysitting right now?", and the answer lived only in
    # the agent's prose.
    #
    # Half of the fix is one layer down: the adapter used to complete such a
    # call at LAUNCH, reading the acknowledgement as the result, so there was
    # nothing on the wire for any of this to be drawn from
    # (`acp/patches/README.md`).
    When I ask the agent "watch"
    Then the chat says a background task is watching "kolu fleet watch"
    And the chat says that task is still running
    And the chat says how long a running call has been going
    # ... and the STRIP says it too, above the scroll. That is not a second copy
    # of the row: it is the half a row at its birth position cannot serve, since
    # by the time somebody asks whether their watch is still up, the answer is
    # an hour of scrollback away.
    And the strip says "kolu fleet watch" is running
    # THE TURN IS OVER, AND SO IS THE NEXT ONE — and the next one buries the
    # arming row, which is what every long session does to it. Two claims here:
    # the row is NOT marked abandoned (a call that armed a task is the one call
    # whose whole point is to outlive its turn), and the strip goes on answering
    # from where the reader now is.
    When I ask the agent "flood"
    Then the transcript is scrolled to the newest line
    And the call that armed the task is out of sight
    And the chat says that task is still running
    And the strip says "kolu fleet watch" is running
    # ... AND THEN IT DIES, in a turn nobody sent. The death lands where the
    # reader is LOOKING — a fresh row at the bottom, at the moment it happens —
    # rather than only as an edit to a row an hour up the scroll. The strip
    # clears with it, and the arming row keeps the record of what it was.
    When the agent is released
    Then the newest line says "exit code 3"
    And the chat says nothing is running in the background
    And the chat says that task ended "failed"
    And the chat shows the harness saying "exit code 3"

  @scratch:chat
  Scenario: An async agent's report folds under the spawning row, never as a person speaking
    # The verified leak (2026-09-01): an async Agent's completion injects a
    # user-role `<task-notification>` carrying the subagent's whole report,
    # stamped `origin.kind: "task-notification"` in the session stream. The
    # panel drew that payload RAW in the column — literal `#` markers, no
    # fold, no attribution. docs/chat.md forbids it twice: the report lives
    # in the spawn's fold, and a background agent's ending is one row at
    # the bottom in the harness's own words.
    When I ask the agent "subagent notify"
    Then the chat says a background task is watching "count the ticks"
    And the agent is idle
    When the agent is released
    Then the newest line says "finished"
    And the chat does not show my message "I have thorough coverage"
    And the chat does not show my message "<task-notification>"
    When I unfold the tool call
    Then the spawn's fold carries "I have thorough coverage"
    And the spawn's fold carries "Findings"

  @scratch:chat
  Scenario: The shipped path files the report on the task stamp, not as a leftover chunk
    # The notify scenario above stamps origin on a user_message_chunk no
    # adapter actually sends (`toAcpNotifications` carries messageId /
    # parentToolUseId only). The path every real user gets is a
    # tool_call_update carrying `_meta.claudeCode.backgroundTask.report`.
    When I ask the agent "subagent report"
    Then the chat says a background task is watching "count the ticks"
    And the agent is idle
    When the agent is released
    Then the newest line says "finished"
    And the chat does not show my message "I have thorough coverage"
    And the chat does not show my message "<task-notification>"
    When I unfold the tool call
    Then the spawn's fold carries "I have thorough coverage"
    And the spawn's fold carries "Findings"
