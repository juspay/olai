@scratch:lanes @agent-stored
Feature: A node agent keeps its session navigation while reading history
  Background:
    Given I open the outline "lanes.olai"
    When I open the filed conversation "the last conversation" as node "filed-chat"

  Scenario: History navigation works before and after reloading without changing the node binding
    When I open the fold history
    And I open the past session "an older conversation"
    Then the panel header names the node agent "the last conversation"
    When I open the fold history
    Then the past session "an older conversation" is selected
    When I return to the node agent's current session
    Then the panel header names the node agent "the last conversation"
    # The row this reads is in the file the conversation was filed under, and
    # the conversation is its page: the crumb is the reader's way there.
    When I follow the page's file crumb
    Then the vault node "filed-chat" has property "agent-session" holding "claude:fake-stored-new"
    When I ask the agent "back in the current node conversation"
    Then the agent has answered "back in the current node conversation" exactly once
    When I open the fold history
    And I open the past session "an older conversation"
    And I reload the page
    And the node agent's fold is ready
    Then the panel header names the node agent "the last conversation"
    # A RELOAD KEEPS THE NODE'S BINDING, NOT THE TAB'S VISIT. The visit is this
    # document's memory, and with the reader on a plain outline address the
    # fresh fold opens the property's session. MASTER DOES THE SAME: zoom into
    # the node, follow the file crumb, reopen, reload — no PR code — leaves
    # `fake-stored-new` open and `an older conversation` merely offered. So the
    # old reveal address kept the visit, not a reading this PR leaks. The older
    # conversation is still there to pick, and that is what the reload keeps.
    When I open the fold history
    Then the past sessions hold "an older conversation"
    When I open the past session "an older conversation"
    And I open the fold history
    Then the past session "an older conversation" is selected
    When I return to the node agent's current session
    And I ask the agent "current session after reload"
    Then the agent has answered "current session after reload" exactly once

  Scenario: Visiting another node agent does not replace the first agent's history or binding
    When I open the fold history
    And I open the past session "an older conversation"
    And I press the agent "door-live"
    Then the panel header names the node agent "watch the connector"
    When I ask the agent "another node is still usable"
    Then the agent has answered "another node is still usable" exactly once
    When I press the agent "filed-chat"
    Then the panel header names the node agent "the last conversation"
    When I open the fold history
    Then the past sessions hold "an older conversation"
    When I follow the page's file crumb
    Then the vault node "filed-chat" has property "agent-session" holding "claude:fake-stored-new"
