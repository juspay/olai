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
  # is border-box under `max-width: 56rem` — so --chat-w came out of the reading
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
