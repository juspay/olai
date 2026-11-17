@scratch:chat
Feature: Closing a node's agent releases it, and the conversation stays the engine's
  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent" from the node menu
    And the node agent's fold is ready
    Then the panel header names the node agent "install the cabinets"
    When I ask the agent "cabinet installed session"
    Then the agent has answered "cabinet installed session" exactly once
    When I remember this conversation as "installed"

  Scenario: Closing from the agent line releases the node and files the conversation nowhere
    When I press the close-agent control
    Then no agent fold is open
    And the agents roster has no row for "install"
    # NOTHING PICKS IT UP. Closing takes the tie off, and a conversation is
    # somebody's only because an ITEM names it — so the roster is empty here
    # and after a restart, rather than a freed conversation turning into a row
    # of its own somewhere.
    And the agents roster holds 0 agents
    When the server stops
    And the server starts again on the same port
    And I open the app
    And I open the outline "house.olai"
    Then the agents roster holds 0 agents
    # ... AND NOTHING WAS LOST EITHER: the conversation is still in the
    # engine's own store, and naming it on a row by hand — the `+` at the end
    # of the property run, which is the recovery a person has — is all it
    # takes to go on reading it.
    When I zoom into the node "install"
    And I add a property on "install"
    And I name the chat tie of remembered conversation "installed" on "install"
    When I press the agent "install"
    And the node agent's fold is ready
    Then the agent has answered "cabinet installed session" exactly once

  Scenario: Closing from the row menu releases the node too
    When I open the node menu of "install"
    And I choose "Close the agent" from the node menu
    Then no agent fold is open
    And the agents roster has no row for "install"

  # THE THIRD PLACE THE VERB LIVES, and the one a person reaches from the
  # column rather than from the file: the Chats row's own `•••`. Same catalog,
  # same act — the binding goes, and the row goes with it.
  Scenario: Closing from the Chats row menu releases the node as well
    When I open the outline "yard.olai"
    And I open the Chats menu of "install"
    Then the Chats menu offers "Put to sleep, Tidy memory, Close the agent"
    When I choose "Close the agent" from the Chats menu
    Then the agents roster has no row for "install"

  Scenario: A closed agent stays plain across reload and server restart
    When I press the close-agent control
    Then no agent fold is open
    When I reload the page
    And I open the outline "house.olai"
    Then the agents roster holds 0 agents
    And the agents roster has no row for "install"
    When I hover the agent start pill on "install"
    Then the agent start pill on "install" is visible
    When the server stops
    And the server starts again on the same port
    And I open the app
    Then the agents roster holds 0 agents
    And the agents roster has no row for "install"
