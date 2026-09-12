@scratch:chat
Feature: Node session ownership follows changes to the node
  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the node agent's fold is ready
    And I ask the agent "first cabinet history"
    Then the agent has answered "first cabinet history" exactly once
    When I remember this conversation as "first"
    And I open the session picker
    And I start a fresh session
    Then the panel is ready in a new conversation after "first"
    When I ask the agent "current cabinet conversation"
    Then the agent has answered "current cabinet conversation" exactly once
    When I remember this conversation as "current"
    And I open the session picker
    And I open the past session "first cabinet history"
    Then the panel is in the remembered conversation "first"

  Scenario: Moving a node between outlines preserves its history and its writes still reach the vault
    When I click the title of "install"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "the yard"
    And I choose "the yard" from the move picker
    Then the node "install" in "yard.olai" sits under "yard"
    When I click the outline "yard.olai"
    And I show the done nodes
    Then the panel header names the node agent "install the cabinets"
    When I ask the agent "done hinges"
    Then the agent is idle
    And node "hinges" is done
    When I ask the agent "done fence"
    Then the agent is idle
    And node "fence" is done
    And the chat shows no refusal
    When I open the session picker
    And I return to the node agent's current session
    Then the panel is in the remembered conversation "current"
    And there should be no page errors

  Scenario: Trashing and restoring a node keeps its conversations, and writes still reach the vault
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "install"
    And the agents roster holds 0 agents
    And no agent fold is open
    When I open the Trash
    And I put back "install" from the Trash
    Then "house.olai" holds the node "install"
    When I press the agent "install"
    Then the node "hinges" is shown
    When I show the done nodes
    Then the panel is in the remembered conversation "current"
    When I open the session picker
    And I open the past session "first cabinet history"
    Then the panel is in the remembered conversation "first"
    And the panel header names the node agent "install the cabinets"
    When I ask the agent "done order"
    Then the agent is idle
    And node "order" is done
    And the chat shows no refusal
    When I ask the agent "done hinges"
    Then the agent is idle
    And node "hinges" is done
    And node "install" still binds remembered conversation "current" in "house.olai"
    And there should be no page errors

  Scenario: Restoring chat while reading node history restores the same scoped conversation
    When I open the plugins panel
    And I switch the plugin "chat" off
    Then chat controls are gone-from the outline
    When I switch the plugin "chat" on
    And I close the plugins panel
    And the node agent's fold is ready
    And I open the session picker
    And I open the past session "first cabinet history"
    Then the panel is in the remembered conversation "first"
    And the panel header names the node agent "install the cabinets"
    When I show the done nodes
    And I ask the agent "done order"
    Then the agent is idle
    And node "order" is done
    And the chat shows no refusal
    When I open the session picker
    And I return to the node agent's current session
    Then the panel is in the remembered conversation "current"
    And there should be no page errors

  Scenario: Renaming a node updates its historical session header without changing its binding
    When I click the title of "install"
    And I select all and type "fit the cabinets"
    And I press "Enter"
    Then the panel header names the node agent "fit the cabinets"
    And the panel is in the remembered conversation "first"
    When I open the session picker
    And I return to the node agent's current session
    Then the panel is in the remembered conversation "current"
    And the panel header names the node agent "fit the cabinets"
    And there should be no page errors

  Scenario: Editing the binding on the page re-points the node agent
    When I zoom into the node "install"
    And I edit the property "chat-agent-session" on "install"
    And I type the binding for remembered conversation "first" into the property editor
    When I press the agent "install"
    Then the panel is in the remembered conversation "first"
    When I ask the agent "binding changed on the page"
    Then the agent has answered "binding changed on the page" exactly once
    And there should be no page errors
