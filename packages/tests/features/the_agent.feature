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
  Scenario: A turn can be cancelled mid-stream
    When I ask the agent "slow"
    Then the agent is working
    When I cancel the turn
    Then the agent is idle
    And the chat says the turn was cancelled

  @scratch:chat
  Scenario: A cancel the agent never received says so
    # The regression this exists for: the cancel notification's failure was
    # swallowed whole, so a cancel aimed at an agent whose pipe had died typed
    # as a success — the button was pressed, the turn went on streaming, and
    # nothing on screen said which of those two had happened. `deaf` is an
    # agent that is alive and no longer reading, which is the shape of that
    # failure a scenario can make happen on purpose.
    When I ask the agent "deaf"
    Then the agent is working
    When I cancel the turn
    Then the chat eventually shows "the turn could not be cancelled"
    And the agent is working

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
  Scenario: A new conversation empties the panel
    # The panel shows ONE conversation. A break line under the old rows was
    # tried and is not what "new conversation" means to the person who pressed
    # it: the agent's context is gone, so nothing above could be followed up,
    # and a transcript you cannot refer to is history kept for its own sake.
    When I ask the agent "hello"
    Then the agent's answer mentions "you said: hello"
    When I start a new conversation
    Then the chat is empty
