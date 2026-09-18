@codex @agent-stored @scratch:chat
Feature: A fresh start may pick a different engine
  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the node agent's fold is ready
    Then the panel header names the node agent "install the cabinets"
    When I ask the agent "cabinet first session"
    Then the agent has answered "cabinet first session" exactly once
    When I remember this conversation as "first"

  Scenario: With two engines, fresh start opens the engine menu and can pick the other one
    When I request a fresh session with "Codex" without confirming
    Then the panel is in the remembered conversation "first"
    When I cancel the fresh session
    Then the panel is in the remembered conversation "first"
    When I start a fresh session with "Codex"
    Then the panel has a different conversation from "first"
    And the panel header names the node agent "install the cabinets"
    When I ask the agent "cabinet codex session"
    Then the agent has answered "cabinet codex session" exactly once
    When I remember this conversation as "codex"
    # The fresh start crossed the engine boundary: the fold now runs the
    # Codex engine, and the old Claude session is a past session of it.
    And I open the fold history
    Then the panel says this agent has had 1 past session
    And the past sessions hold "cabinet first session"

  Scenario: The node's old history follows it across the engine change
    When I start a fresh session with "Codex"
    Then the panel has a different conversation from "first"
    When I remember this conversation as "codex"
    And I open the fold history
    And I open the past session "cabinet first session"
    Then the panel is in the remembered conversation "first"
    And the agent has answered "cabinet first session" exactly once
    And the panel header names the node agent "install the cabinets"
    When I return to the node agent's current session
    Then the panel is in the remembered conversation "codex"

  Scenario: The superseded first session is not a chat nobody claims
    When I start a fresh session with "Codex"
    And the node agent's fold is ready
    Then the panel has a different conversation from "first"
    # The Claude session the Codex fresh start replaced is still owned by the
    # node — the roster holds one agent, and the node menu's only new verb is
    # another fresh start, never a claim to a chat the node already owns.
    And the agents roster holds 1 agents
    When I open the node menu of "install"
    Then the node menu does not offer "Start an agent session"
    And the node menu offers "Fresh start — Codex"
    And the node menu offers "Close the agent"

  Scenario: The cross-engine node agent survives a server restart
    When I start a fresh session with "Codex"
    Then the panel has a different conversation from "first"
    When I ask the agent "cabinet codex session"
    Then the agent has answered "cabinet codex session" exactly once
    When I remember this conversation as "codex"
    And the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    Then the panel is in the remembered conversation "codex"
    And the agent has answered "cabinet codex session" exactly once
    When I open the fold history
    Then the past sessions hold "cabinet first session"
    And I open the past session "cabinet first session"
    Then the panel is in the remembered conversation "first"

  Scenario: The row menu fresh-starts onto the other engine
    When I open the node menu of "install"
    And I choose "Fresh start — Codex" from the node menu
    Then the node menu asks "Start a fresh conversation for “install the cabinets”? This replaces the current conversation. Its transcript remains in past sessions."
    And the panel is in the remembered conversation "first"
    When I choose "Cancel" from the node menu
    And I choose "Fresh start — Codex" from the node menu
    And I choose "Fresh start — Codex" from the node menu
    Then the node agent's fold is ready
    And the panel has a different conversation from "first"
    When I ask the agent "row menu codex"
    Then the agent has answered "row menu codex" exactly once
    When I open the fold history
    Then the panel says this agent has had 1 past session
    And the past sessions hold "cabinet first session"
