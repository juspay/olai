@scratch:chat
Feature: A stale fresh-session action cannot create a chat for a removed node
  Scenario: Removing a node before a delayed tab starts fresh leaves its original conversation intact
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I rewrite "removed-agent.olai" as:
      """
      {"id":"removed-agent","ord":"a0","title":"Temporary node agent"}
      """
    And I open the outline "removed-agent.olai"
    When I open the node menu of "removed-agent"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "Temporary node agent"
    And the agent panel is open
    When I ask the agent "before removal"
    Then the agent has answered "before removal" exactly once
    When I remember this conversation as "before removal"
    And I remember the served bytes of "removed-agent.olai"
    And I open the session picker
    And I hold incoming updates to the original browser tab
    And I remove the served file "removed-agent.olai"
    And I open another browser tab
    Then the agent panel is open
    And the panel is in the remembered conversation "before removal"
    When I use the original browser tab
    And I start a fresh session
    And I release incoming updates to the original browser tab
    Then the panel is in the remembered conversation "before removal"
    And the agent has answered "before removal" exactly once
    When I restore the remembered served bytes of "removed-agent.olai"
    Then the panel header names the node agent "Temporary node agent"
    When I open the session picker
    Then the node session control counts 1 conversations
    And the roster offers no unassigned chats
    When I start a fresh session
    Then the panel has a different conversation from "before removal"
    When I ask the agent "after restoring the node"
    Then the agent has answered "after restoring the node" exactly once
    When I open the session picker
    Then the panel says this agent has had 1 past session
    When I open the past session "before removal"
    Then the panel is in the remembered conversation "before removal"
    And the agent has answered "before removal" exactly once
    And there should be no page errors
