@scratch:lanes @agent-stored
Feature: A node agent keeps its session navigation while reading history
  Background:
    Given I open the outline "lanes.olai"
    And the agent panel is open
    When I open the unassigned chats
    And I assign the conversation "the last conversation" to the node titled "a lane nobody has put an agent on", searching for "lane nobody"
    And I close the unassigned chats

  Scenario: History navigation works before and after reloading without changing the node binding
    When I open the session picker
    And I open the past session "an older conversation"
    Then the panel header names the node agent "a lane nobody has put an agent on"
    When I open the session picker
    Then the past session "an older conversation" is selected
    When I return to the node agent's current session
    Then the panel header names the node agent "a lane nobody has put an agent on"
    And the node "lane-fresh" shows the property "agent-session" holding "claude:fake-stored-new"
    When I ask the agent "back in the current node conversation"
    Then the agent has answered "back in the current node conversation" exactly once
    When I open the session picker
    And I open the past session "an older conversation"
    And I reload the page
    And the agent panel is open
    Then the panel header names the node agent "a lane nobody has put an agent on"
    When I open the session picker
    Then the past session "an older conversation" is selected
    When I return to the node agent's current session
    And I ask the agent "current session after reload"
    Then the agent has answered "current session after reload" exactly once

  Scenario: Visiting another node agent does not replace the first agent's history or binding
    When I open the session picker
    And I open the past session "an older conversation"
    And I press the agent "door-live"
    Then the panel header names the node agent "watch the connector"
    When I ask the agent "another node is still usable"
    Then the agent has answered "another node is still usable" exactly once
    When I press the agent "lane-fresh"
    Then the panel header names the node agent "a lane nobody has put an agent on"
    When I open the session picker
    Then the past sessions hold "an older conversation"
    And the node "lane-fresh" shows the property "agent-session" holding "claude:fake-stored-new"
