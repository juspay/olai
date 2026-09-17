@scratch:chat
Feature: Closing a node's agent releases it back to an unclaimed chat
  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the node agent's fold is ready
    Then the panel header names the node agent "install the cabinets"
    When I ask the agent "cabinet installed session"
    Then the agent has answered "cabinet installed session" exactly once
    When I remember this conversation as "installed"

  Scenario: Closing from the agent line releases the node and returns the conversation to the unclaimed chats
    When I press the close-agent control
    Then no agent fold is open
    And the agents roster holds 0 agents
    # The close's own filer run files the freed conversation before any
    # restart could — this row appears because `closeAgent` publishes a full
    # filing, not because a boot's filing happened to pick it up.
    And the Inbox has 1 filed conversations
    And the agents roster holds 1 agents
    When the server stops
    And the server starts again on the same port
    And I open the app
    Then the Inbox has 1 filed conversations
    And the agents roster holds 1 agents
    When I open the filed conversation "cabinet installed session" as node "filed-install"
    And the node agent's fold is ready
    Then the agent has answered "cabinet installed session" exactly once

  Scenario: Closing from the row menu releases the node too
    When I open the node menu of "install"
    And I choose "Close the agent" from the node menu
    Then no agent fold is open
    And the agents roster holds 0 agents

  Scenario: A closed agent stays plain across reload and server restart
    When I press the close-agent control
    Then no agent fold is open
    When I reload the page
    And I open the outline "house.olai"
    Then the agents roster holds 1 agents
    And the agents roster has no row for "install"
    When I hover the agent start pill on "install"
    Then the agent start pill on "install" is visible
    When the server stops
    And the server starts again on the same port
    And I open the app
    Then the agents roster holds 1 agents
    And the agents roster has no row for "install"
