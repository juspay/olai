Feature: the agent panel

  The chat panel docks to the right edge: closed until asked for, remembered
  across loads, and beside the outline rather than over it. A turn is drawn
  from frames that arrive on the page's one SSE connection — the same
  connection the live outline rides — so the panel and the outline have to
  stay out of each other's way.

  The agent is the fake one (olai/tests/integration/fake-acp-agent.rkt): it
  answers any ordinary prompt with "hello world" and one tool call.

  Scenario: the panel is closed until I ask for it, and the × puts it back
    When I open the home page
    Then the chat panel is closed
    When I press the agent toggle
    Then the chat panel is open
    When I close the chat panel
    Then the chat panel is closed

  Scenario: the panel is still open after a reload
    When I open the home page
    And I press the agent toggle
    And I reload the page
    Then the chat panel is open

  # The page carries no conversation at all — it comes out of the server empty,
  # because what it could say about one would be as old as the request (the
  # agent may still be waking up). So the conversation a reload comes back to
  # is the one the new connection is caught up with, and nothing else.
  Scenario: a reload comes back to the conversation
    When I open the home page
    And I press the agent toggle
    And I send "what is in the outline" to the agent
    Then the last turn reads "hello world"
    When I reload the page
    Then the last turn quotes me "what is in the outline"
    And the last turn reads "hello world"
    And the last turn ran the tool "read Tasks.rkt"
    And the chat panel is idle

  # Issue #14: the gutter the panel needs was PADDING on .ol-main, and .ol-main
  # is border-box under `max-width: 56rem` — so --panel-w came out of the reading
  # column's own cap instead of out of the free space beside it. The outline
  # kept its full border box (right edge under the panel), and the text wrapped
  # into whatever the padding left, three words to a line, with the gutter
  # sitting empty. Both numbers below say it: the column stayed wide enough to
  # read, and it ends before the panel starts.
  Scenario: an open panel leaves the outline a column you can still read
    When I open the home page
    And I press the agent toggle
    Then the outline column is at least 20 rem wide
    And the outline column stops before the chat panel

  Scenario: a turn shows what I said, what it said, and what it ran
    When I open the home page
    And I press the agent toggle
    And I send "what is in the outline" to the agent
    Then the last turn quotes me "what is in the outline"
    And the last turn reads "hello world"
    And the last turn ran the tool "read Tasks.rkt"
    And the chat panel is idle

  Scenario: the panel says the agent is working, and stops saying it
    When I open the home page
    And I press the agent toggle
    And I send a slow prompt to the agent
    Then the chat panel is busy
    And the chat panel is idle
    And the last turn reads "hello world"

  Scenario: an outline edit does not swap the conversation away
    When I open the home page
    And I press the agent toggle
    And I send "what is in the outline" to the agent
    Then the last turn reads "hello world"
    And I mark this page load
    When I add the title "Renew the passport" to the outline
    Then I see the title "Renew the passport"
    And the page has not reloaded
    And the chat panel is open
    And the last turn reads "hello world"

  # Tool calls are machine chatter: they arrive folded, one compact line each,
  # and unfold when asked. Folding is the browser's, like the outline's
  # collapse — the transcript keeps every call in full either way, and no
  # frame on the wire knows a line is shut.
  Scenario: a tool call arrives folded and unfolds when I ask
    When I open the home page
    And I press the agent toggle
    And I send "what is in the outline" to the agent
    Then the last turn ran the tool "read Tasks.rkt"
    And the last turn's tool call is folded
    When I unfold the last turn's tool call
    Then the last turn's tool call is unfolded
    And the last turn ran the tool "read Tasks.rkt"

  # What folding is FOR. A real agent's tool titles are shell commands and
  # absolute paths, and they used to wrap into paragraphs that buried the
  # answer above them. Folded, a title with more to say than the line has room
  # for is cut off at the line; unfolded, all of it is there. LONGTOOL is what
  # asks the fake agent for one of those (olai/tests/integration).
  Scenario: a title too long for its line is cut off until I unfold it
    When I open the home page
    And I press the agent toggle
    And I send "LONGTOOL what did you run" to the agent
    Then the last turn's tool call is folded
    And the tool call's title is cut off
    When I unfold the last turn's tool call
    Then the last turn's tool call is unfolded
    And unfolding put the whole title on screen

  # Only the chatter folds. What the agent SAID is what the panel is for, and
  # there is nothing in it to press.
  Scenario: the agent's own words never fold
    When I open the home page
    And I press the agent toggle
    And I send "what is in the outline" to the agent
    Then the last turn reads "hello world"
    And the agent's words have nothing to unfold

  # A line you unfolded must not shut under you. Two things move the panel
  # after it: the outline's live re-swap beneath it, and another turn arriving
  # in it — and the fold is keyed by the call's own id, so even the transcript
  # being rebuilt around it brings it back open.
  Scenario: an unfolded tool call stays unfolded while the panel keeps moving
    When I open the home page
    And I press the agent toggle
    And I send "what is in the outline" to the agent
    Then the last turn ran the tool "read Tasks.rkt"
    When I unfold the last turn's tool call
    And I add the title "Renew the passport" to the outline
    Then I see the title "Renew the passport"
    And the first turn's tool call is unfolded
    When I send "anything else" to the agent
    Then the chat panel is idle
    And the first turn's tool call is unfolded
    # Same id, same line: that is the frame vocabulary's own rule (web/chat),
    # and the fake agent reuses one. So the line drawn into the new turn is a
    # new element that comes up OPEN — which is the keyed re-apply a rebuilt
    # transcript rides on, with nothing to rebuild it here but a second turn.
    And the last turn's tool call is unfolded
