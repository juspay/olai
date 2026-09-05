@scratch:chat
Feature: Fresh node sessions have distinct identities and durable history
  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    Then the panel header names the node agent "install the cabinets"
    When I ask the agent "cabinet first session"
    Then the agent has answered "cabinet first session" exactly once
    When I remember this conversation as "first"

  Scenario: A fresh chat on an existing node can be sent to and both sessions revisited
    When I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "first"
    And the panel header names the node agent "install the cabinets"
    And the chat is empty
    When I ask the agent "cabinet second session"
    Then the agent has answered "cabinet second session" exactly once
    When I remember this conversation as "second"
    And I open the session picker
    Then the panel says this agent has had 1 past session
    When I open the past session "cabinet first session"
    Then the panel is in the remembered conversation "first"
    And the agent has answered "cabinet first session" exactly once
    And the panel header names the node agent "install the cabinets"
    When I open the session picker
    And I return to the node agent's current session
    Then the panel is in the remembered conversation "second"
    And the agent has answered "cabinet second session" exactly once
    When I reload the page
    And the agent panel is open
    Then the panel is in the remembered conversation "second"
    When I open the session picker
    And I open the past session "cabinet first session"
    Then the panel is in the remembered conversation "first"

  Scenario: Starting a fresh session while viewing history replaces the current session and keeps the whole chain
    When I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "first"
    When I ask the agent "cabinet second session"
    Then the agent has answered "cabinet second session" exactly once
    When I remember this conversation as "second"
    And I open the session picker
    And I open the past session "cabinet first session"
    And I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "first"
    And the panel has a different conversation from "second"
    And the panel header names the node agent "install the cabinets"
    When I ask the agent "cabinet third session"
    Then the agent has answered "cabinet third session" exactly once
    When I open the session picker
    Then the panel says this agent has had 2 past sessions
    And the past sessions hold "cabinet first session"
    And the past sessions hold "cabinet second session"

  Scenario: Replacing an unused fresh session does not strand earlier history
    When I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "first"
    When I remember this conversation as "unused"
    And I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "unused"
    When I ask the agent "cabinet third session"
    Then the agent has answered "cabinet third session" exactly once
    When I open the session picker
    Then the past sessions hold "cabinet first session"

  Scenario: Both node sessions remain readable after the server restarts
    When I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "first"
    When I ask the agent "cabinet second session"
    Then the agent has answered "cabinet second session" exactly once
    When I remember this conversation as "second"
    And the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    And I press the agent "install"
    Then the panel is in the remembered conversation "second"
    And the agent has answered "cabinet second session" exactly once
    When I open the session picker
    And I open the past session "cabinet first session"
    Then the panel is in the remembered conversation "first"
    And the agent has answered "cabinet first session" exactly once

  Scenario: Resuming a node's past session keeps its subtree write boundary
    When I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "first"
    When I ask the agent "cabinet second session"
    Then the agent has answered "cabinet second session" exactly once
    When I open the session picker
    And I open the past session "cabinet first session"
    Then the panel is in the remembered conversation "first"
    When I ask the agent "done order"
    Then the agent is idle
    And the chat shows a refusal
    And node "order" is not done

  Scenario: Restarting while reading node history restores its write boundary
    When I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "first"
    When I ask the agent "cabinet second session"
    Then the agent has answered "cabinet second session" exactly once
    When I open the session picker
    And I open the past session "cabinet first session"
    Then the panel is in the remembered conversation "first"
    When the server stops
    And the server starts again on the same port
    And I open the app
    And the agent panel is open
    Then the panel is in the remembered conversation "first"
    And the panel header names the node agent "install the cabinets"
    When I ask the agent "done order"
    Then the agent is idle
    And the chat shows a refusal
    And node "order" is not done

  Scenario: A current node turn keeps running while its history is read and continued
    When I show the done nodes
    And I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "first"
    When I remember this conversation as "current"
    And I ask the agent "hold"
    Then the agent "install" stands "working"
    When I open the session picker
    And I open the past session "cabinet first session"
    Then the panel is in the remembered conversation "first"
    And the agent "install" stands "working"
    When I ask the agent "done hinges"
    Then node "hinges" is done
    And the agent "install" stands "working"
    When I press the agent "install"
    Then the agent is working
    When the agent is released
    Then the panel is in the remembered conversation "current"
