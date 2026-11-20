@scratch:lanes @agent-stored
Feature: A node agent keeps its session navigation while reading history
  Background:
    Given I open the outline "lanes.olai"
    And node "lane-fresh" in "lanes.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "lane-fresh"

  Scenario: History navigation works before and after reloading without changing the node binding
    When I open the fold history
    And I open the past session "an older conversation"
    Then the panel header names the node agent "a lane nobody has put an agent on"
    When I open the fold history
    Then the past session "an older conversation" is selected
    When I return to the node agent's current session
    Then the panel header names the node agent "a lane nobody has put an agent on"
    When I return to the conversation's outline
    Then the vault node "lane-fresh" has property "chat-agent-session" holding "claude:fake-stored-new"
    When I ask the agent "back in the current node conversation"
    Then the agent has answered "back in the current node conversation" exactly once
    When I open the fold history
    And I open the past session "an older conversation"
    And I reload the page
    And the node agent's fold is ready
    Then the panel header names the node agent "a lane nobody has put an agent on"
    When I open the fold history
    Then the past sessions hold "an older conversation"
    When I open the past session "an older conversation"
    And I open the fold history
    Then the past session "an older conversation" is selected
    When I return to the node agent's current session
    And I ask the agent "current session after reload"
    Then the agent has answered "current session after reload" exactly once

  Scenario: A roster frame does not shut the history picker
    Given I open the outline "lanes.olai"
    When I open the "claude" agent on node "door-live"
    And the node agent's fold is ready
    And I ask the agent "hold"
    And I open the fold history
    When the agent is released
    Then the history picker on "door-live" is still open

  Scenario: Visiting another node agent does not replace the first agent's history or binding
    When I open the fold history
    And I open the past session "an older conversation"
    And I press the agent "door-live"
    Then the panel header names the node agent "watch the connector"
    When I ask the agent "another node is still usable"
    Then the agent has answered "another node is still usable" exactly once
    When I press the agent "lane-fresh"
    Then the panel header names the node agent "a lane nobody has put an agent on"
    When I open the fold history
    Then the past sessions hold "an older conversation"
    When I return to the conversation's outline
    Then the vault node "lane-fresh" has property "chat-agent-session" holding "claude:fake-stored-new"
