@codex @scratch:chat
Feature: Codex continues the same turn after compaction
  Compaction is an ordinary tool item, not a prompt completion or a new session.

  Background:
    Given I open the app
    And the agent panel is open
    When I choose the agent "codex"

  Scenario: A completed compaction is followed by more output in the same turn
    When I ask the agent "compact"
    Then the agent's answer mentions "Compact conversation"
    And the agent is working
    And the header says the agent is working

    When the agent is released
    Then the agent's answer mentions "Continued after compaction."
    And the agent is idle
    And compaction continuation is diagnosed across the chat wire
    And there should be no page errors
    And the header has stopped saying the agent is working

  Scenario: Steering after compaction reaches the original prompt
    When I ask the agent "compact"
    Then the agent's answer mentions "Compact conversation"
    And the agent is working
    And the header says the agent is working

    When I ask the agent "keep going"
    Then the agent's answer mentions "steered mid-turn: keep going"
    And the agent is working
    When the agent is released
    Then the agent's answer mentions "Continued after compaction."
    And the agent is idle
    And compaction continuation is diagnosed across the chat wire
    And there should be no page errors

  Scenario: A tab reconnects after compaction while the backend continues
    When I ask the agent "compact"
    Then the agent's answer mentions "Compact conversation"
    And the agent is working
    And the header says the agent is working

    When the browser goes offline
    Then the connection is "reconnecting"
    When the agent is released
    And the browser comes back online
    Then the connection is "live"
    And the agent's answer mentions "Continued after compaction."
    And the agent is idle
    And compaction continuation is diagnosed across the chat wire
    And there should be no page errors

  Scenario: Steering waits through in-progress compaction and reaches the same prompt
    When I ask the agent "compact during"
    Then the chat shows a running tool call
    When I ask the agent "during compaction"
    And the agent is released
    Then the agent's answer mentions "steered mid-turn: during compaction"
    And the agent is working
    When the agent is released
    Then the agent's answer mentions "Continued after compaction."
    And the agent is idle
    And compaction continuation is diagnosed across the chat wire
    And there should be no page errors

  Scenario: A steer can be injected after its deadline without being silently retried
    When I ask the agent "compact during"
    Then the chat shows a running tool call
    When I ask the agent "late compaction steer"
    Then the chat eventually shows my message "late compaction steer" as "unanswered"
    And the server records the unanswered steering deadline
    And the chat offers no way to send it again
    And the agent is working
    When the agent is released
    Then the agent's answer mentions "steered mid-turn: late compaction steer"
    And the chat shows my message "late compaction steer" as "unanswered"
    When the agent is released
    Then the agent's answer mentions "Continued after compaction."
    And the agent is idle
    And there should be no page errors

  Scenario: promptRequired with the original prompt still open attempts a new prompt visibly
    When I ask the agent "compact fallback"
    Then the chat shows a running tool call
    When I ask the agent "fallback message"
    And the agent is released
    Then the agent's answer mentions "still working on the earlier turn"
    And the chat shows my message "fallback message" as "refused"
    And the agent is working
    When the agent is released
    Then the agent's answer mentions "Continued after compaction."
    And the agent is idle
    And there should be no page errors

  Scenario: An accepted fallback prompt completes without ending the older prompt
    When I ask the agent "compact fallback accept"
    Then the chat shows a running tool call
    When I ask the agent "accepted fallback"
    And the agent is released
    Then the agent's answer mentions "host-owned fallback completed"
    And the agent is working
    And the header says the agent is working
    When the agent is released
    Then the agent's answer mentions "Continued after compaction."
    And the agent is idle
    And the header has stopped saying the agent is working
    And there should be no page errors
