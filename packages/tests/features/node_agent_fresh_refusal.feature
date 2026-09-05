@scratch:chat
Feature: A refused node fresh-session request leaves its current work usable
  Scenario: Answering the current question permits a refused fresh-session request to be retried
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "install the cabinets"
    And the agent panel is open
    When I remember this conversation as "question session"
    And I mark the page
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I type "answer after a refused fresh session" into the question's "note" box
    And I open the session picker
    And I start a fresh session
    Then the fresh-session control refuses "a turn is running; cancel it before switching conversations" and allows retry
    And the panel is in the working conversation "question session"
    When I press "Escape"
    Then the question's "note" box still reads "answer after a refused fresh session"
    When I type "2" into the question's "howMany" box
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "answer after a refused fresh session"
    When I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "question session"
    When I ask the agent "fresh after answering"
    Then the agent has answered "fresh after answering" exactly once
    When I open the session picker
    Then the panel says this agent has had 1 past session
    When I open the past session "askstrict"
    Then the panel is in the remembered conversation "question session"
    And the agent's answer mentions "answer after a refused fresh session"
    And the page has not reloaded
    And there should be no page errors
