Feature: Talking to a node agent
  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I mark the page

  @scratch:chat
  Scenario: The agent checks something off and the tree follows
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "done order"
    Then node "order" is done
    And the page has not reloaded
    And the agent's answer mentions "marked"

  @scratch:chat
  Scenario: A parent is marked like any other node once the branch is finished
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "done install"
    Then node "install" is done
    And the chat shows no refusal
    And the chat says the write "Done"
    And the write's nudge says "every task under `kitchen remodel #home` is done now"
    When I ask the agent "done kitchen"
    Then node "kitchen" is done

  @scratch:chat
  Scenario: A refused write shows its detail in chat
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "done nowhere"
    Then the chat shows a refusal
    And the chat shows a tool call named "Mark done"
    And the chat shows no story under the call

  @scratch:chat
  Scenario: What you said is not what the agent said
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hello"
    Then the chat shows my message "hello"
    And the agent's answer mentions "you said: hello"
    And my message sits to the right of the agent's

  @scratch:chat
  Scenario: A tool call is one foldable line
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "done order"
    Then the chat shows a completed tool call
    And the tool call's detail is folded away

  @scratch:chat
  Scenario: A report that arrives twice is one report
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "twice"
    Then the chat shows 1 tool call
    And the chat shows a completed tool call
    And the agent's answer mentions "said the same thing twice"
    And the agent is idle

  @scratch:chat
  Scenario: The conversation is the main agent's, and a subagent's calls are behind a door
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "subagent"
    Then the conversation carries none of the subagent's calls
    And the call that spawned it offers a door to 2 calls, as "explore the outline"
    And the call that spawned it is in no lane of its own

  @scratch:chat
  Scenario: Pressing that door opens the agent's own work, drawn as it always was
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "subagent"
    And I open the agent's work from the transcript
    Then the agent's work is open, and it is "explore the outline"
    And the agent's work shows 2 calls
    And the agent's work is above the conversation and clear of the box
    And I can close the agent's work

  @scratch:chat
  Scenario: The strip is the other door, and it carries one entry per agent out
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "subagent slow"
    Then the strip lists 1 agents still out
    When I open "read every note" from the strip
    Then the agent's work is open, and it is "read every note"
    And the agent's work shows nothing yet
    When the agent is released
    Then the strip lists no agent still out
    And the agent's work shows 1 calls

  @scratch:chat
  Scenario: An agent sent MORE WORK is back on the strip, under the same door
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "subagent slow"
    Then the strip lists 1 agents still out
    When the agent is released
    Then the strip lists no agent still out
    And the call that spawned it offers a door to 1 calls, as "read every note"
    When I ask the agent "subagent again"
    Then the strip lists 1 agents still out
    When I open "read every note" from the strip
    Then the agent's work is open, and it is "read every note"
    When the agent is released
    Then the strip lists no agent still out
    And the call that spawned it offers a door to 2 calls, as "read every note"
    And the agent's work shows 2 calls

  @scratch:chat
  Scenario: An agent that has been sent out and reported nothing yet still has a face
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "subagent slow"
    Then the chat says an agent is working, of the kind "Explore"
    And the call that spawned it offers no door yet
    When the agent is released
    Then the call that spawned it offers a door to 1 calls, as "read every note"
    And the chat says no agent is still working

  @scratch:chat
  Scenario: A face does not outlive the agent that was wearing it
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "subagent crash"
    Then the chat says an agent is working, of the kind "Explore"
    When the agent is released
    Then the chat says no agent is still working
    And the chat still shows a call that sent out an "Explore"

  @scratch:chat
  Scenario: A call that keeps running says how long it has been
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hold"
    Then the chat says how long a running call has been going
    And that elapsed time is ticking
    When the agent is released
    Then the chat times no call

  @scratch:chat
  Scenario: A call one turn gave up on does not start ticking in the next
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "abandon"
    Then the chat still shows a call the wire calls "in_progress"
    And the chat times no call
    When I ask the agent "hold"
    Then the chat says how long a running call has been going
    And the chat still shows a call the wire calls "in_progress"
    When the agent is released
    Then the chat times no call

  @scratch:chat
  Scenario: A stopwatch does not outlive the turn it was timing
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "subagent crash"
    Then the chat says how long a running call has been going
    When the agent is released
    Then the chat times no call
    And the chat still shows a call that sent out an "Explore"

  @scratch:chat
  Scenario: A file the agent rewrote shows what changed, trimmed
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "edit"
    Then the chat shows a diff of "notes.md"
    And the diff is trimmed
    When I expand the diff
    Then the diff is expanded
    And the diff shows the line "- a walnut worktop, ordered on the tenth" as added

  @scratch:chat
  Scenario: An edit that landed in three places draws all three, and the page survives it
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hunks"
    Then the chat shows 3 diffs of "notes.md"
    And there should be no page errors

  @scratch:chat
  Scenario: An outline the agent rewrote by hand is still never a text diff
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "edit house.olai"
    Then the chat shows the outline "house.olai" changing
    And the outline change says "Note changed"
    And the chat shows no diff

  @scratch:chat
  Scenario: A long line in a file-edit diff wraps inside the box
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
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
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
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
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "edit huge.md"
    Then the chat shows a diff of "huge.md"
    And the diff says it was rewritten whole

  @scratch:chat
  Scenario: An olai write tells its story instead of showing a diff
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "done order"
    Then the chat says the write "Done"
    And the chat shows no diff

  @scratch:chat
  Scenario: A turn can be cancelled mid-stream
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "slow"
    Then the agent is working
    When I cancel the turn
    Then the agent is idle
    And the chat says the turn was cancelled

  @scratch:chat
  Scenario: A cancel that did not stop the turn says so
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "deaf"
    Then the agent is working
    When I cancel the turn
    Then the chat eventually shows "the agent was asked to stop and has said nothing since"
    And the agent is working

  @scratch:chat
  Scenario: An agent still working towards the stop is not accused of ignoring it
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "talkative"
    Then the agent is working
    When I cancel the turn
    Then the agent's answer mentions "still working 7"
    And the chat says nothing went wrong

  @scratch:chat
  Scenario: An answer this panel cannot draw leaves a mark, not a blank
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "picture"
    Then the agent's answer mentions "here it is:"
    And the agent's answer mentions "[image]"

  @scratch:chat
  Scenario: A link the agent wrote opens the page it names, in place
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "links"
    Then the agent's answer mentions "the cabinets note"
    When I follow the link "the cabinets note" in the agent's answer
    Then the address is "/notes/cabinets.md"
    And the page has not reloaded
    And no agent fold is open
    When I unfold node agent "kitchen"
    Then the chat shows my message "links"
    When I follow the link "the order row" in the agent's answer
    Then the unified destination row "order" is selected
    And the page has not reloaded

  @scratch:chat
  Scenario: Alt+click on a link the agent wrote opens it to the right
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "links"
    Then the agent's answer mentions "the cabinets note"
    When I alt-click the link "the cabinets note" in the agent's answer
    Then there are 2 panes
    And pane 1 is showing "/notes/cabinets.md"
    And the page has not reloaded

  @scratch:chat
  Scenario: The input completes the agent's own slash commands
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "/re" into the chat
    Then the completion offers "review"
    When I accept the completion
    Then the chat input reads "/review "

  @scratch:chat
  Scenario: ...and it answers only the keys aimed at the box
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "/re" into the chat
    Then the completion offers "review"
    When I focus the preferences trigger
    And I press Enter
    Then the preferences are open
    And the chat input reads "/re"

  @agent-stored @scratch:chat
  Scenario: A conversation comes back with what was said and what was done
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    Then the chat shows my message "what did we decide?"
    And the chat shows a completed tool call
    And the chat shows a tool call named "read the notes"

  @agent-stored @scratch:chat
  Scenario: The conversation survives a restart of the server
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    Given the chat eventually shows "we decided to order the cabinets"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    Then the chat eventually shows "we decided to order the cabinets"

  @agent-stored @scratch:chat
  Scenario: A message sent while a conversation is opening does not open a second one
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    Given the chat eventually shows "we decided to order the cabinets"
    When the next conversation load will hang
    And I press the agent "kitchen"
    And I open the fold history
    And I begin opening the past session "an older conversation"
    And I ask the agent "hello"
    And the agent is released
    Then the agent's answer mentions "you said: hello"
    And the opened conversation carries the title "an older conversation"

  @agent-stored @scratch:chat
  Scenario: An agent that refuses a stored conversation remains available for retry
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When the agent refuses to load a conversation
    And I press the agent "kitchen"
    Then the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "no such conversation"
    And there is nothing to type into
    When the agent will load a conversation again
    And I try to open it again
    Then the panel shows no such refusal
    And the agent is idle
    When I ask the agent "hello"
    Then the agent's answer mentions "you said: hello"

  @agent-stored @scratch:chat
  Scenario: A stored conversation refused after restart can be retried
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen" in its outline
    And the node agent's fold is ready
    When I press the agent "kitchen" in its outline
    And I open the fold history
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    When the next conversation load will hang
    And the server stops
    And the server starts again on the same port
    And I open the app
    And I press the agent "kitchen" in its outline
    And I unfold node agent "kitchen"
    Then the agent "kitchen" stands "waking"
    And I open the fold history
    When the agent refuses to load a conversation
    And the agent is released
    Then the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "no such conversation"
    Then the history picker on "kitchen" is still open
    And I begin opening the past session "an older conversation"
    Then the panel says the conversation could not be opened
    And there is nothing to type into
    When the agent will load a conversation again
    And the next conversation load will hang
    And I try to open it again
    And I try to open it again
    Then the chat says the click was refused, with "no conversation is waiting to be opened" or "the conversation changed; this action was not applied"
    When the agent is released
    Then the panel shows no such refusal
    And the opened conversation carries the title "an older conversation"
    And the agent is idle

  @no-agent @scratch:chat
  Scenario: Without an engine the outline remains usable
    Then the agent start pill on "kitchen" is absent
    And no agent fold is open
    And the outline list is shown

  @agent-stored @scratch:chat
  Scenario: A refused listing does not disturb the conversation it could not list
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    And I ask the agent "lose"
    Then the chat eventually shows "the conversation store is unreadable"
    And the chat eventually shows "we decided to order the cabinets"
    And the chat input takes typing

  @agent-stored @scratch:chat
  Scenario: A tied node opens its stored history
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    When I press the agent "kitchen"
    And I open the fold history
    Then the past sessions hold "an older conversation"
    When I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"

  @scratch:chat
  Scenario: The panel shows the turn happening, not only its result
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
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
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
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
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hold"
    Then the agent is working
    And the panel header names the model "Fake One"
    And the header says the agent is working
    When I close the agent fold
    Then the aside on "kitchen" stands "working"
    When I open the agent fold again
    And the agent is released
    Then the agent is idle
    And the header has stopped saying the agent is working
    And the panel header names the model "Fake One"

  @scratch:chat
  Scenario: A row that changes is the same row, not a new one
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
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
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
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
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the panel header says nothing about the context
    When I ask the agent "hello"
    Then the agent is idle
    And the panel header says the context is "13k/200k"
    When I ask the agent "hello again"
    Then the agent is idle
    And the panel header says the context is "26k/200k"

  @scratch:chat
  Scenario: The context readout says what it counts, hovered or not
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And I ask the agent "hello"
    Then the agent is idle
    And the panel header says the context is "13k/200k"
    And the context readout is called "Context used" beside the number
    And the context readout carries no native tooltip
    When I hover the panel's context readout
    Then a tip says "Context used"

  @scratch:chat
  Scenario: The context window itself can move, and the header follows that too
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hello"
    Then the panel header says the context is "13k/200k"
    When I ask the agent "window 1000000 hold"
    Then the agent is working
    And the panel header says the context is "25k/200k"
    When the agent is released
    Then the agent is idle
    And the panel header says the context is "26k/1M"

  @scratch:chat
  Scenario: A new conversation is not asked how full the last one was
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hello"
    Then the panel header says the context is "13k/200k"
    When I start a fresh session
    Then the agent is idle
    And the panel header says nothing about the context

  @scratch:chat
  Scenario: The header follows the model the agent is actually running
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the panel header names the model "Fake One"
    When I ask the agent "model fake-model-2"
    Then the agent is idle
    And the panel header names the model "Fake One"
    When I ask the agent "hello"
    Then the panel header names the model "Fake Two"

  @scratch:chat
  Scenario: A running model is named the way the picker names it, not as a raw id
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the panel header names the model "Fake One"
    When I ask the agent "model claude-sonnet-5"
    And I ask the agent "hello"
    Then the panel header names the model "Fake Sonnet"

  @scratch:chat
  Scenario: A model the picker cannot name without inventing is named as its raw id
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "model claude-opus-5"
    And I ask the agent "hello"
    Then the panel header names the model "claude-opus-5"
    When I ask the agent "model claude-haiku-4-5-20251001"
    And I ask the agent "hello"
    Then the panel header names the model "claude-haiku-4-5-20251001"
    When I ask the agent "model claude-haiku-4-5"
    And I ask the agent "hello"
    Then the panel header names the model "Fake Haiku"

  @scratch:chat
  Scenario: The picker repeating itself does not undo a model the CLI reported
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "model claude-sonnet-5"
    And I ask the agent "hello"
    Then the panel header names the model "Fake Sonnet"
    When I ask the agent "reconfig"
    Then the agent is idle
    And the panel header names the model "Fake Sonnet"

  @agent-stored @scratch:chat
  Scenario: A model the conversation was switched to survives a restart
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    When I ask the agent "model claude-sonnet-5"
    And I ask the agent "hello"
    Then the panel header names the model "Fake Sonnet"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    Then the opened conversation carries the title "the last conversation"
    And the panel header names the model "Fake Sonnet"
    When I ask the agent "hello"
    Then the panel header names the model "Fake Sonnet"

  @agent-stored @scratch:chat
  Scenario: A conversation nobody switched follows the machine's default, and is not pinned to it
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    Then the panel header names the model "Fake One"
    When I ask the agent "hello"
    Then the panel header names the model "Fake One"
    When the agent's pinned model becomes "fake-model-2"
    And the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    Then the opened conversation carries the title "the last conversation"
    And the panel header names the model "Fake Two"
    And the chat says nothing went wrong

  @agent-stored @scratch:chat
  Scenario: A model that cannot be put back says so, and is still tried at the next restart
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    When I ask the agent "model claude-opus-5"
    And I ask the agent "hello"
    Then the panel header names the model "claude-opus-5"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    Then the opened conversation carries the title "the last conversation"
    And the chat eventually shows "could not be put back"
    And the panel header names the model "Fake One"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    Then the chat eventually shows "could not be put back"

  @scratch:chat
  Scenario: A message sent mid-turn WAITS ITS TURN, and the row says so
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hold"
    Then the agent is working
    And the chat input takes typing
    And the composer says a message would queue
    When I ask the agent "done order"
    Then the chat input still has the caret
    And the chat eventually shows "done order"
    And node "order" is not done
    And the chat shows my message "done order" as waiting
    And the agent is working
    When the agent is released
    Then my message "done order" is no longer waiting
    And node "order" is done
    And the agent is idle

  @scratch:chat
  Scenario: The interrupting gesture puts a message INTO the running turn
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hold"
    Then the agent is working
    And the composer offers an interruption
    When I interrupt the agent with "done order"
    Then node "order" is done
    And the agent is working
    And my message "done order" is no longer waiting
    When the agent is released
    Then the agent is idle

  @scratch:chat
  Scenario: Once this conversation has queued, the interruption is withdrawn
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hold"
    Then the agent is working
    And the composer offers an interruption
    When I ask the agent "hello"
    Then the chat shows my message "hello" as waiting
    And the composer offers no interruption
    When the agent is released
    Then the agent is idle
    When I ask the agent "hold"
    Then the agent is working
    And the composer offers no interruption
    When I interrupt the agent with "done order" by keyboard
    Then the chat shows my message "done order" as waiting
    And node "order" is not done
    When the agent is released
    Then node "order" is done
    And the agent is idle
    When I start a fresh session
    Then the chat is empty
    When I ask the agent "hold"
    Then the agent is working
    And the composer offers an interruption
    When the agent is released
    Then the agent is idle

  @scratch:chat
  Scenario: Alt+Enter is the same gesture as the button
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hold"
    Then the agent is working
    When I interrupt the agent with "done order" by keyboard
    Then node "order" is done
    And the agent is working
    When the agent is released
    Then the agent is idle

  @scratch:chat
  Scenario: An agent that advertises nothing is offered nothing, and still works
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When the agent advertises nothing about itself
    And the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
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
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "refuse busy"
    Then the agent's answer mentions "a second message while working will be refused from here on."
    And the agent is idle
    When I ask the agent "hold"
    Then the agent's answer mentions "working on it"
    And the agent is working
    When I ask the agent "done order"
    Then the chat shows my message "done order" as "refused"
    And the strip under my message "done order" reads "Not sent"
    And my message "done order" is no longer waiting
    And node "order" is not done
    And the agent is working
    When the agent is released
    Then the agent is idle
    When I send the undelivered message again
    Then node "order" is done
    And no message is marked undelivered

  @scratch:chat
  Scenario: A queued message still says so in a tab that has just arrived
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hold"
    Then the agent is working
    When I ask the agent "done order"
    Then the chat shows my message "done order" as waiting
    When I open the app
    And I unfold node agent "kitchen"
    Then the chat shows my message "done order" as waiting
    And the agent is working
    When the agent is released
    Then my message "done order" is no longer waiting
    And node "order" is done
    And the agent is idle

  @scratch:chat
  Scenario: Cancel stops the turn, and the message waiting behind it still runs
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "slow"
    Then the agent is working
    When I ask the agent "done order"
    Then the chat shows my message "done order" as waiting
    When I cancel the turn
    Then the chat says the turn was cancelled
    And the chat says it once
    And node "order" is done
    And my message "done order" is no longer waiting
    And no message is marked undelivered

  @scratch:chat
  Scenario: A message the agent REFUSED stays on screen, and can be sent again
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "refuse steering"
    Then the agent is idle
    When I ask the agent "hold"
    Then the agent is working
    When I interrupt the agent with "done order"
    Then the chat shows my message "done order" as "refused"
    And the strip under my message "done order" reads "Not sent"
    And node "order" is not done
    When I send the undelivered message again
    Then no message is marked undelivered
    And the chat shows my message "done order" as waiting
    And node "order" is not done
    When the agent is released
    Then node "order" is done
    And my message "done order" is no longer waiting
    And the agent is idle

  @scratch:chat
  Scenario: A message the agent never ANSWERED says so, and offers no retry
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "swallow steering"
    Then the agent is idle
    When I ask the agent "hold"
    Then the agent is working
    When I interrupt the agent with "done order"
    Then the chat eventually shows my message "done order" as "unanswered"
    And the chat shows my message "done order"
    And the strip under my message "done order" reads "No reply. It may not have arrived."
    And the chat offers no way to send it again
    And the chat eventually shows "did not answer"
    When the agent is released
    Then the agent is idle

  @scratch:chat
  Scenario: A turn that died having said NOTHING marks the message that started it
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "vanish"
    Then the chat eventually shows "the agent exited"
    And the chat shows my message "vanish" as "unanswered"
    And the strip under my message "vanish" reads "No reply. It may not have arrived."
    And the chat offers no way to send it again

  @scratch:chat
  Scenario: A turn that SPOKE before it died leaves the message alone
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "crash"
    Then the agent's answer mentions "about to fall over"
    And the chat eventually shows "the agent exited"
    And the chat shows my message "crash"
    And no message is marked undelivered

  @scratch:chat
  Scenario: A turn the agent REFUSED ends the turn, not the conversation
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "error"
    Then the chat eventually shows "this turn cannot be run in the mode"
    And the agent is idle
    And the chat input takes typing
    And the chat shows my message "error" as "refused"
    When I ask the agent "hello"
    Then the agent's answer mentions "you said: hello"
    And the agent is idle
    And the chat says nothing went wrong

  @scratch:chat
  Scenario: Cancelling under a message in flight does not start the turn back up
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "slow steering"
    Then the agent is idle
    When I ask the agent "slow"
    Then the agent is working
    When I interrupt the agent with "done order"
    And I cancel the turn
    Then the chat shows my message "done order" as "refused"
    And the agent is idle
    And node "order" is not done

  @scratch:chat
  Scenario: The transcript follows the newest line, unless I have scrolled away
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "flood"
    Then the agent is idle
    And the transcript is scrolled to the newest line
    When I scroll the transcript to the top
    And I ask the agent "flood"
    Then the agent is idle
    And the transcript has stayed where I left it

  @scratch:chat
  Scenario: Opening a conversation with a transcript lands on the newest line
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "flood"
    Then the agent is idle
    And the transcript is scrolled to the newest line
    When I scroll the transcript to the top
    And I close the agent fold
    And I open the outline "yard.olai"
    And I open the outline "house.olai"
    And I open the agent fold again
    Then the chat eventually shows "line 39"
    And the transcript is scrolled to the newest line

  @agent-stored @scratch:chat
  Scenario: Picking a stored conversation lands on the newest line
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen" in its outline
    And the node agent's fold is ready
    When I ask the agent "flood"
    Then the agent is idle
    And the transcript is scrolled to the newest line
    When I scroll the transcript to the top
    And I press the agent "kitchen" in its outline
    And I open the fold history
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    And the chat eventually shows "line 39"
    And the transcript is scrolled to the newest line

  @agent-stored @scratch:chat
  Scenario: Opening a long conversation does not scroll through its history
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen" in its outline
    And the node agent's fold is ready
    When I arm a slow replay on the next stored conversation
    And I record where the transcript scrolls
    And I open the fold history
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    And the chat eventually shows "line 39"
    And the transcript is scrolled to the newest line
    And the transcript did not scroll through the conversation while it was replayed

  @agent-stored @scratch:chat
  Scenario: Growth after opening still lands on the newest line
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen" in its outline
    And the node agent's fold is ready
    When I arm late growth on the next stored conversation
    And I press the agent "kitchen" in its outline
    And I open the fold history
    And I open the past session "an older conversation"
    Then the opened conversation carries the title "an older conversation"
    And the chat eventually shows "line 39"
    And the transcript is scrolled to the newest line
    And the chat does not yet show "late line"
    When the agent is released
    Then the chat eventually shows "late line"
    And the transcript is scrolled to the newest line

  @scratch:chat
  Scenario: The agent's question is a form in the conversation, and the answer goes back
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "ask"
    Then the chat shows a question
    And the question offers "oak"
    And the composer says the agent is waiting on me
    And the header says the agent is working
    When I choose "birch"
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "\"question_0\":\"birch\""
    And the question has been answered
    And the question can no longer be answered

  @scratch:chat
  Scenario: The free-text box beside a question is what travels
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "ask"
    Then the chat shows a question
    When I choose "oak"
    And I type "walnut, actually" into the question's other box
    And I answer the question
    Then the agent's answer mentions "\"question_0_custom\":\"walnut, actually\""

  @scratch:chat
  Scenario: Dismissing a question tells the agent, rather than answering for me
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "ask"
    Then the chat shows a question
    When I dismiss the question
    Then the agent is idle
    And the agent's answer mentions "\"action\":\"decline\""
    And the question says I dismissed it

  @scratch:chat
  Scenario: A cancelled turn takes its question back
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "ask"
    Then the chat shows a question
    When I cancel the turn
    Then the agent is idle
    And the question says the agent took it back
    And the composer has stopped saying the agent is waiting on me

  @scratch:chat
  Scenario: Leaving plan mode is asked, not assumed
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "plan"
    Then the chat shows a question
    And the question offers "auto"
    When I choose "No, keep planning"
    And I answer the question
    Then the agent's answer mentions "permission: plan"

  @scratch:chat
  Scenario: An answer the question refuses keeps what I typed
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "askstrict"
    Then the chat shows a question
    When I type "the oak ones" into the question's "note" box
    And I answer the question
    Then the chat shows a refusal
    And the chat shows a question
    And the question's "note" box still reads "the oak ones"
    When I type "40" into the question's "howMany" box
    And I answer the question
    Then the question has been answered
    And the agent's answer mentions "\"howMany\":40"
    And the agent's answer mentions "the oak ones"

  @scratch:chat
  Scenario: A tool nothing has named is asked about, not approved
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "nameless"
    Then the chat shows a question
    And the question offers "reject"
    When I choose "Deny"
    And I answer the question
    Then the agent's answer mentions "permission: reject"

  @scratch:chat
  Scenario: A permission a subagent asked for says which subagent is asking
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "subagent asks"
    Then the chat shows a question
    And the question is drawn in the lane of the agent that asked it
    And the question's lane names itself, as "explore the outline"
    And the conversation carries none of the subagent's calls
    When I choose "Allow Once"
    And I answer the question
    Then the agent's answer mentions "permission: allow"
    And the question is drawn in the lane of the agent that asked it
    And exactly one lane names itself, as "explore the outline"
    And no lane introduces itself under the question

  @scratch:chat
  Scenario: A shelf open over a question says so, because the form is not in it
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
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
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "subagent elicits"
    Then the chat shows a question
    And the question is drawn in the lane of the agent that asked it
    And the question's lane names itself, as "explore the outline"
    And the conversation carries none of the subagent's calls
    When I choose "oak"
    And I answer the question
    Then the agent's answer mentions "oak"
    And exactly one lane names itself, as "explore the outline"
    And no lane introduces itself under the question

  @scratch:chat
  Scenario: An answered question is still there after a reload
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "ask"
    Then the chat shows a question
    When I choose "birch"
    And I answer the question
    Then the question has been answered
    When I reload the page
    And the node agent's fold is ready
    Then the question has been answered
    And the question shows "birch" as what I chose

  @scratch:chat
  Scenario: Permission for an ops tool needs nobody
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "permit"
    Then the agent is idle
    And the agent's answer mentions "permission: allow"
    And the chat shows no question

  @scratch:chat
  Scenario: A pasted picture reaches the agent as a file it can read
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I paste a picture called "shot.png" into the chat
    Then the composer is holding the picture "shot.png"
    When I ask the agent "what is this"
    Then the agent's answer mentions "read 70 bytes from shot.png"
    And the conversation shows the picture "shot.png"

  @scratch:chat
  Scenario: A screen recording reaches the agent as a file it can read
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I pick "ScreenRecording 23-01-06_1.mp4" with the attach button
    Then the composer is holding "ScreenRecording_23-01-06_1.mp4", showing how big it is
    When I drop "take.mov" on the chat panel
    Then the composer is holding "ScreenRecording_23-01-06_1.mp4, take.mov" in that order
    And the composer is holding "take.mov", showing how big it is
    When I ask the agent "what went wrong here"
    Then the agent's answer mentions "read 24 bytes from ScreenRecording_23-01-06_1.mp4"
    And the agent's answer mentions "read 24 bytes from take.mov"
    And the composer is holding nothing

  @scratch:chat
  Scenario: A kind olai does not take is refused before it is uploaded
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I paste a picture called "logo.svg" into the chat
    Then the chat eventually shows "cannot be attached"
    And the composer is holding nothing

  @scratch:chat
  Scenario: A picture dropped on the panel reaches the agent the same way
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I drag "shot.png" over the chat panel
    Then the panel shows where the drop will land
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
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
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
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I drag some selected text over the chat panel
    Then the panel is not offering to take a drop

  @scratch:chat
  Scenario: Several files in one drop attach in the order they were dropped
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I drop "one.png, two.png, three.png" on the chat panel
    Then the composer is holding "one.png, two.png, three.png" in that order
    When I ask the agent "what are these"
    Then the agent read "one.png, two.png, three.png" in that order

  @scratch:chat
  Scenario: A dropped PDF and a dropped text file reach the agent as files it reads
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I drop "Type 04-C.pdf, notes.txt" on the chat panel
    Then the composer is holding "Type_04-C.pdf, notes.txt" in that order
    And the composer is holding "Type_04-C.pdf", showing how big it is
    And the composer is holding "notes.txt", showing how big it is
    When I ask the agent "what are these"
    Then the agent's answer mentions "read 69 bytes from Type_04-C.pdf"
    And the agent's answer mentions "read 5 bytes from notes.txt"

  @scratch:chat
  Scenario: A picked file goes in the same way a dropped one does
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I pick "Type 04-C.pdf" with the attach button
    Then the composer is holding "Type_04-C.pdf", showing how big it is
    When I ask the agent "what is this"
    Then the agent's answer mentions "read 69 bytes from Type_04-C.pdf"

  @scratch:chat
  Scenario: The camera is offered only where a finger is the pointer
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the composer is not offering a camera
    When I pick "shot.png" with the attach button
    Then the composer is holding the picture "shot.png"

  @scratch:chat @phone
  Scenario: Photos shot straight into the chat all ride one message
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I take a photo called "porch.jpg" with the camera
    Then the composer is holding the picture "porch.jpg"
    When I take a photo called "porch.jpg" with the camera
    Then the composer is holding "porch.jpg, porch-1.jpg" in that order
    When I take a photo called "door.jpg" with the camera
    Then the composer is holding "porch.jpg, porch-1.jpg, door.jpg" in that order
    When I ask the agent "what are these"
    Then the agent read "porch.jpg, porch-1.jpg, door.jpg" in that order

  @scratch:chat @phone
  Scenario: A thumb's return key says Send, and sends
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the chat composer's return key is labelled "send"
    When I type "hello from a thumb" into the chat and send it with the return key
    Then the chat shows my message "hello from a thumb"
    And the agent's answer mentions "you said: hello from a thumb"
    And there should be no page errors

  @scratch:chat @phone
  Scenario: A dismissed capture touches nothing — not even somebody else's refusal
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I drop "whatever.zip" on the chat panel
    Then the chat eventually shows "cannot be attached"
    And the chat eventually shows "whatever.zip"
    When I dismiss the camera
    Then the composer is holding nothing
    And the chat still shows "cannot be attached"

  @scratch:chat @phone
  Scenario: Recorded videos and library clips ride one message
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I record a video called "porch.mp4"
    Then the composer is holding "porch.mp4", showing how big it is
    When I record a video called "porch.mp4"
    Then the composer is holding "porch.mp4, porch-1.mp4" in that order
    When I pick "library.mov" with the attach button
    Then the composer is holding "library.mov", showing how big it is
    When I ask the agent "read these recordings"
    Then the agent read "porch.mp4, porch-1.mp4, library.mov" in that order

  @scratch:chat @phone
  Scenario: An unnamed QuickTime capture gets a video name
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I record an unnamed QuickTime video
    Then the composer is holding "recorded.mov", showing how big it is
    When I ask the agent "read this unnamed recording"
    Then the agent read "recorded.mov" in that order
    And the composer is holding nothing

  @scratch:chat @phone
  Scenario: Dismissing the camcorder preserves the draft and refusal
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I record a video called "keep.mp4"
    Then the composer is holding "keep.mp4", showing how big it is
    When I type "keep this draft" into the chat
    And I drop "whatever.zip" on the chat panel
    Then the chat eventually shows "cannot be attached"
    When I dismiss the camcorder
    Then the composer is holding "keep.mp4" in that order
    And the chat input reads "keep this draft"
    And the chat still shows "cannot be attached"

  @scratch:chat
  Scenario: Pasted video bytes take the same path as dropped recordings
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I paste a video called "clipboard.mp4" into the chat
    Then the composer is holding "clipboard.mp4", showing how big it is
    When I drop "dropped.mov" on the chat panel
    Then the composer is holding "dropped.mov", showing how big it is
    When I ask the agent "read the clips"
    Then the agent read "clipboard.mp4, dropped.mov" in that order

  @scratch:chat
  Scenario: A dropped file olai cannot take says so, by name
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I drop "archive.zip" on the chat panel
    Then the chat eventually shows "cannot be attached"
    And the chat eventually shows "archive.zip"
    And the composer is holding nothing

  @scratch:chat
  Scenario: A drop that is half pictures takes them and names what it would not
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I drop "shot.png, archive.zip" on the chat panel
    Then the composer is holding the picture "shot.png"
    And the chat eventually shows "archive.zip"
    When I ask the agent "what is this"
    Then the agent's answer mentions "read 70 bytes from shot.png"

  @scratch:chat
  Scenario: A background task the agent armed is visible from where the reader is, and so is its death
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "watch"
    Then the chat says a background task is watching "kolu fleet watch"
    And the chat says that task is still running
    And the chat says how long a running call has been going
    And there is no terminal output
    And the strip says "kolu fleet watch" is running
    When I ask the agent "flood"
    Then the transcript is scrolled to the newest line
    And the call that armed the task is out of sight
    And the chat says that task is still running
    And the strip says "kolu fleet watch" is running
    When the agent is released
    Then the newest line says "exit code 3"
    And the chat says nothing is running in the background
    And the chat says that task ended "failed"
    And the chat shows the harness saying "exit code 3"
    And there is no terminal output

  @scratch:chat
  Scenario: An async agent's report folds under the spawning row, never as a person speaking
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
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
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
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

  @agent-stored @scratch:chat
  Scenario: Choosing a model through ACP reaches the agent and survives a restart
    Given node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
    And the node agent's fold is ready
    Then the panel header names the model "Fake One"
    When I choose the chat model "Fake Two"
    Then the panel header names the model "Fake Two"
    When I ask the agent "hello"
    Then the panel header names the model "Fake Two"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    Then the opened conversation carries the title "the last conversation"
    And the panel header names the model "Fake Two"
    When I ask the agent "hello"
    Then the panel header names the model "Fake Two"

  @scratch:chat
  Scenario: A refused model selection leaves the current model usable
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Given the agent refuses model changes
    When I choose the chat model "Fake Two"
    Then the chat shows a refusal
    And the panel header names the model "Fake One"
    When I ask the agent "hello"
    Then the panel header names the model "Fake One"

  @scratch:chat
  Scenario: A model the account is not entitled to says so, in the agent's words
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Given the signed-in account may not use the model "fable"
    When I choose the chat model "Fake Fable"
    Then the chat refusal says "Fake Fable isn't available for your account yet"
    And the chat refusal does not say "Internal error"
    And the panel header names the model "Fake One"
    When I choose the chat model "Fake Two"
    Then the panel header names the model "Fake Two"
    When I ask the agent "hello"
    Then the panel header names the model "Fake Two"

  @scratch:chat
  Scenario: Model selection waits for the running turn to finish
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hold"
    Then the agent is working
    And the model picker is disabled
    When the agent is released
    Then the agent is idle
    When I choose the chat model "Fake Two"
    Then the panel header names the model "Fake Two"

  @scratch:chat
  Scenario: The model picker can undo a model changed through the CLI
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "model claude-sonnet-5"
    And I ask the agent "hello"
    Then the panel header names the model "Fake Sonnet"
    When I choose the chat model "Fake One"
    Then the panel header names the model "Fake One"
    When I ask the agent "hello"
    Then the panel header names the model "Fake One"

  @scratch:chat
  Scenario: Typing in the model menu narrows it
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I open the session settings
    And I filter the chat models by "haiku"
    Then the model picker offers only "Fake Haiku"
    When I pick the model under the cursor
    Then the model picker is shut
    And the panel header names the model "Fake Haiku"
    And the caret is back on the model picker
    And the agent is idle

  @scratch:chat
  Scenario: A filter nothing matches offers nothing
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I open the session settings
    And I filter the chat models by "zzz"
    Then the model picker offers nothing for "zzz"
    When I pick the model under the cursor
    Then the model picker offers nothing for "zzz"
    And the panel header names the model "Fake One"

  @scratch:chat
  Scenario: Arrow keys walk what is visible
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I open the session settings
    And I filter the chat models by "s"
    Then the model picker offers only "Fake Sonnet, Fake Opus (1M context)"
    When I press "ArrowDown" in the model filter
    And I pick the model under the cursor
    Then the panel header names the model "Fake Opus (1M context)"

  @scratch:chat
  Scenario: The filter is forgotten on reopen
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I open the session settings
    And I filter the chat models by "haiku"
    Then the model picker offers only "Fake Haiku"
    When I press "Escape" in the model filter
    And I open the session settings
    Then the model picker offers only "Fake One, Fake Two, Fake Sonnet, Fake Haiku, Fake Opus (1M context), Fake Fable"

  @scratch:chat
  Scenario: Claude's olai write has its title, outline, clickable story and one reply
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "done order"
    Then the chat shows a tool call named "Mark done"
    And the tool call says which outline it touched
    And the tool call says where it is working
    And the chat says the write "Done"
    When I press the node "order" in the write
    Then the node "order" is focused
    When I unfold the tool call
    Then the tool call is called "mcp__olai__outlines_done" underneath
    And the tool call's reply is shown once

  @scratch:chat
  Scenario: Claude's olai read has a title and outline with no write story
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I drop row "order" into the conversation
    And I ask the agent "context"
    Then the chat shows a completed tool call
    And the chat shows a tool call named "Read a node"
    And the tool call says which outline it touched
    And the chat shows no story under the call

  @scratch:chat
  Scenario: Late MCP recognition relabels the call and preserves its first spelling
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "late-done order"
    Then the chat shows a completed tool call
    And the agent is idle
    And the chat shows a tool call named "Mark done"
    And the tool call says which outline it touched
    And the chat says the write "Done"
    When I unfold the tool call
    Then the tool call is called "pending MCP call" underneath
    And the tool call's reply is shown once
