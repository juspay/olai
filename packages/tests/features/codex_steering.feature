@codex @scratch:chat
Feature: Messages sent while Codex works steer its current turn
  The Codex fixture advertises steering without a prompt queue and rejects
  overlapping ordinary prompts. Mid-turn delivery must use steering.

  Background:
    Given I open the app
    And I show the done nodes
    And the agent panel is open
    When I choose the agent "codex"

  Scenario Outline: Normal sends reach the running turn and its busy indicators clear
    When I ask the agent "hold"
    Then the chat shows a running tool call
    When I ask the agent "second message"
    Then the agent's answer mentions "steered mid-turn: second message"
    When I ask the agent "third message"
    Then the agent's answer mentions "steered mid-turn: third message"
    And the agent is working
    And the header says the agent is working
    When <ending>
    Then the agent is idle
    And the header has stopped saying the agent is working
    And the panel does not say it is busy
    When I ask the agent "hello"
    Then the agent's answer mentions "hello"
    And the agent is idle

    Examples:
      | ending                |
      | the agent is released |
      | I cancel the turn     |

  Scenario: A refused steer keeps the message available for retry
    When I ask the agent "refuse steering"
    Then the agent is idle
    When I ask the agent "hold"
    Then the agent is working
    When I ask the agent "done order"
    Then the chat shows my message "done order" as "refused"
    And node "order" is not done
    When the agent is released
    Then the agent is idle
    When I send the undelivered message again
    Then node "order" is done
    And the agent is idle

  Scenario: A steer arriving after completion starts a tracked normal turn
    When I ask the agent "slow steering"
    Then the agent is idle
    When I ask the agent "slow"
    Then the agent is working
    When I ask the agent "done order"
    And the agent is released
    Then node "order" is done
    And the agent is idle
    And the header has stopped saying the agent is working
    And the panel does not say it is busy

  Scenario: Cancelling while a steer is in flight does not start another turn
    When I ask the agent "slow steering"
    Then the agent is idle
    When I ask the agent "slow"
    Then the agent is working
    When I ask the agent "done order"
    And I cancel the turn
    Then the chat shows my message "done order" as "refused"
    And the agent is idle
    And node "order" is not done
    And the panel does not say it is busy
