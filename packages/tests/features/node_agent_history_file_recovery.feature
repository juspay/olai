@scratch:chat
Feature: A restored node recovers its complete conversation history
  Scenario: Removing the outline while reading history does not strand either session after restoration
    Given the harness keeps distinct sessions on disk
    And I rewrite "history-recovery.olai" as:
      """
      {"id":"history-recovery","ord":"a0","title":"History recovery agent"}
      {"id":"outside-recovery","ord":"a1","title":"Outside the recovered agent"}
      """
    And I open the outline "history-recovery.olai"
    When I open the node menu of "history-recovery"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "History recovery agent"
    And the agent panel is open
    When I ask the agent "historical recovery session"
    Then the agent has answered "historical recovery session" exactly once
    When I remember this conversation as "historical"
    And I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "historical"
    When I ask the agent "current recovery session"
    Then the agent has answered "current recovery session" exactly once
    When I remember this conversation as "current"
    And I remember the served bytes of "history-recovery.olai"
    And I open the session picker
    And I open the past session "historical recovery session"
    Then the panel is in the remembered conversation "historical"
    When I remove the served file "history-recovery.olai"
    Then the roster offers 2 unassigned chats
    When I open the unassigned chats
    Then the unassigned list holds "historical recovery session"
    And the unassigned list holds "current recovery session"
    When I close the unassigned chats
    And I restore the remembered served bytes of "history-recovery.olai"
    Then the panel header names the node agent "History recovery agent"
    And the roster offers no unassigned chats
    When I reload the page
    Then the panel header names the node agent "History recovery agent"
    And the agent panel is open
    And the panel is in the remembered conversation "historical"
    When I ask the agent "history continued after restoration"
    Then the agent has answered "history continued after restoration" exactly once
    When I ask the agent "done outside-recovery"
    Then the agent is idle
    And the chat shows a refusal
    And node "outside-recovery" is not done
    When I open the session picker
    And I return to the node agent's current session
    Then the panel is in the remembered conversation "current"
    And the agent has answered "current recovery session" exactly once
    When I ask the agent "current continued after restoration"
    Then the agent has answered "current continued after restoration" exactly once
    And there should be no page errors
