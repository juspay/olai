Feature: Chat remains usable as the plugin runtime changes
  A restored header is not evidence of a working conversation. These scenarios
  send messages through the real sibling wire and ACP process after a flip,
  including a server which had no engine when it started.

  @scratch:chat
  Scenario: A remounted chat can receive and answer a message
    Given I open the app
    And I mark the page
    And the agent panel is open
    When I ask the agent "before the flip"
    Then the agent's answer mentions "you said: before the flip"
    When I open the plugins panel
    And I switch the plugin "chat" off
    Then the conversation is gone-from the header
    When I switch the plugin "chat" on
    And I close the plugins panel
    And the agent panel is open
    And I ask the agent "after the flip"
    Then the agent's answer mentions "you said: after the flip"
    And the page has not reloaded
    And there should be no page errors

  @scratch:chat @plugins:chat
  Scenario: The first engine enabled after startup can hold a conversation
    Given I open the app
    And I mark the page
    And the agent panel is open
    Then the panel says this serve enabled no agent engine
    When I open the plugins panel
    And I switch the plugin "claude" on
    And I close the plugins panel
    And the agent panel is open
    Then the chat input takes typing
    When I ask the agent "first engine arrived"
    Then the agent's answer mentions "you said: first engine arrived"
    And the page has not reloaded
    And there should be no page errors

  @scratch:chat @plugins:chat,claude
  Scenario: Switching the last engine back on restores conversation choices
    Given I open the app
    And I mark the page
    And the agent panel is open
    When I ask the agent "before the engine leaves"
    Then the agent's answer mentions "you said: before the engine leaves"
    When I open the plugins panel
    And I switch the plugin "claude" off
    And I close the plugins panel
    And the agent panel is open
    Then the panel says this serve enabled no agent engine
    When I open the plugins panel
    And I switch the plugin "claude" on
    And I close the plugins panel
    And the agent panel is open
    And I choose the agent "claude"
    And I ask the agent "the engine returned"
    Then the agent's answer mentions "you said: the engine returned"
    And the page has not reloaded
    And there should be no page errors
