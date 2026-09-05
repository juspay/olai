@scratch:chat
Feature: Node conversation controls remain usable after reconnecting
  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I remember this conversation as "cabinet"
    And I mark the page

  Scenario: A pending node question retains its draft and accepts an answer after reconnecting
    When I ask the agent "askstrict"
    Then the chat shows a question
    When I type "answer after reconnect" into the question's "note" box
    And the browser goes offline
    Then the connection is "reconnecting"
    When the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    And the panel is in the working conversation "cabinet"
    And the question's "note" box still reads "answer after reconnect"
    When I type "2" into the question's "howMany" box
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "answer after reconnect"
    And the panel header names the node agent "install the cabinets"
    And the page has not reloaded

  Scenario: Reconnecting while reading node history preserves both history and fresh-chat controls
    When I ask the agent "cabinet before outage"
    Then the agent has answered "cabinet before outage" exactly once
    When I open the session picker
    And I start a fresh session
    And I ask the agent "cabinet current session"
    Then the agent has answered "cabinet current session" exactly once
    When I remember this conversation as "current"
    And I open the session picker
    And I open the past session "cabinet before outage"
    Then the panel is in the remembered conversation "cabinet"
    When the browser goes offline
    Then the connection is "reconnecting"
    When the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    And the panel is in the remembered conversation "cabinet"
    And the agent has answered "cabinet before outage" exactly once
    And the panel header names the node agent "install the cabinets"
    When I open the session picker
    And I return to the node agent's current session
    Then the panel is in the remembered conversation "current"
    When I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "current"
    And the panel has a different conversation from "cabinet"
    When I ask the agent "cabinet after outage"
    Then the agent has answered "cabinet after outage" exactly once
    When I open the session picker
    Then the panel says this agent has had 2 past sessions
    And the past sessions hold "cabinet before outage"
    And the past sessions hold "cabinet current session"
    And the page has not reloaded
