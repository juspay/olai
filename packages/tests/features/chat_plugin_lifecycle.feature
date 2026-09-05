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

  @scratch:chat
  Scenario: An unrelated plugin switch preserves an unsent message and its node context
    Given I open the app
    And I mark the page
    And the agent panel is open
    When I type "context @hing" into the chat
    Then the completion offers "hinges"
    When I accept the completion
    Then the chat input reads "context @hinges "
    And the composer is armed with "hinges"
    When I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And the agent panel is open
    Then the chat input reads "context @hinges "
    And the composer is armed with "hinges"
    When I send the chat message
    Then the agent's answer says "hinges is the node titled pick the hinges"
    And the page has not reloaded
    And there should be no page errors

  @scratch:chat @agent-stored
  Scenario: Unsent drafts stay with their conversation across drawer and session changes
    Given I open the app
    And the agent panel is open
    Then the conversation is titled "the last conversation"
    When I type "only for the last conversation" into the chat
    And I close the agent panel
    And the agent panel is open
    Then the chat input reads "only for the last conversation"
    When I open the unassigned chats
    And I pick the conversation "an older conversation"
    Then the conversation is titled "an older conversation"
    And the chat input reads ""
    When I type "only for the older conversation" into the chat
    And I open the unassigned chats
    And I pick the conversation "the last conversation"
    Then the chat input reads "only for the last conversation"
    When I send the chat message
    Then the agent's answer mentions "you said: only for the last conversation"
    When I close the agent panel
    And the agent panel is open
    Then the chat input reads ""
    And there should be no page errors

  @scratch:chat
  Scenario: Disabling chat during a running turn can settle and be reversed
    Given I open the app
    And I mark the page
    And the agent panel is open
    When I ask the agent "hold"
    Then the chat shows a running tool call
    When I open the plugins panel
    And I switch the plugin "chat" off
    Then the conversation is gone-from the header
    When I switch the plugin "chat" on
    And I close the plugins panel
    And the agent panel is open
    And I ask the agent "after stopping a running plugin"
    Then the agent's answer mentions "you said: after stopping a running plugin"
    And the page has not reloaded
    And there should be no page errors

  @scratch:chat @plugins:chat
  Scenario: Chat can be stopped while waiting for its first engine
    Given I open the app
    And I mark the page
    And the agent panel is open
    Then the panel says this serve enabled no agent engine
    When I open the plugins panel
    And I switch the plugin "chat" off
    And I request that the plugin "claude" be on
    Then the plugins panel says "claude" is "Waiting for agents"
    When I switch the plugin "chat" on
    And I close the plugins panel
    And the agent panel is open
    And I ask the agent "an engine was waiting for chat"
    Then the agent's answer mentions "you said: an engine was waiting for chat"
    And the page has not reloaded
    And there should be no page errors
