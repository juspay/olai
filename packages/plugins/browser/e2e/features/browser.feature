@browser @scratch:chat
Feature: Conversations receive isolated web browser tools
  The executable is a scripted MCP double. These scenarios exercise ACP handoff
  and the visible failure and lifecycle paths without launching Chromium.

  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"

  Scenario: Withdrawal removes future handoffs and scratch, return probes afresh, and reconnect retains the session
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the panel says this conversation has "browser"
    When I ask the agent "servers"
    Then the agent's answer mentions "browser"
    And the browser MCP has been probed 1 time with private scratch
    When I open the plugins panel
    And I switch the plugin "browser" off
    And I close the plugins panel
    Then the browser MCP scratch has been removed
    When I start a fresh session
    Then the chat is empty
    When I ask the agent "servers"
    Then the agent is idle
    And this conversation has no browser MCP server
    When I open the plugins panel
    And I switch the plugin "browser" on
    And I close the plugins panel
    And I start a fresh session
    Then the chat is empty
    And the panel says this conversation has "browser"
    And the browser MCP has been probed 2 times with private scratch
    When I ask the agent "servers"
    Then the agent's answer mentions "browser"
    When the browser goes offline
    Then the connection is "reconnecting"
    When the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    When I ask the agent "servers"
    Then the agent's answer mentions "browser"
    And the browser MCP has been probed 2 times with private scratch
    And there should be no page errors

  Scenario: A broken MCP executable explains its absence and a new conversation retries after repair
    Given the browser MCP fixture answers "garbage"
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the panel says "browser" is missing from this conversation
    And the reason it gives is "Browser tools did not speak the expected MCP protocol"
    When the browser MCP fixture answers "good"
    And I start a fresh session
    Then the chat is empty
    And the panel says this conversation has "browser"
    When I ask the agent "servers"
    Then the agent's answer mentions "browser"
    And the browser MCP has been probed 2 times with private scratch
    And there should be no page errors
