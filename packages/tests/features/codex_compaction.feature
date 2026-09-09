@codex @scratch:chat
Feature: Codex continues the same turn after compaction
  Compaction is an ordinary tool item, not a prompt completion or a new session.

  Background:
    Given I open the app
    And the agent panel is open
    When I choose the agent "codex"
    And I ask the agent "compact"
    Then the agent's answer mentions "Compact conversation"
    And the agent is working
    And the header says the agent is working

  Scenario: A completed compaction is followed by more output in the same turn
    When the agent is released
    Then the agent's answer mentions "Continued after compaction."
    And the agent is idle
    And compaction continuation is diagnosed across the chat wire
    And there should be no page errors
    And the header has stopped saying the agent is working

  Scenario: Steering after compaction reaches the original prompt
    When I ask the agent "keep going"
    Then the agent's answer mentions "steered mid-turn: keep going"
    And the agent is working
    When the agent is released
    Then the agent's answer mentions "Continued after compaction."
    And the agent is idle
    And compaction continuation is diagnosed across the chat wire
    And there should be no page errors

  Scenario: A tab reconnects after compaction while the backend continues
    When the browser goes offline
    Then the connection is "reconnecting"
    When the agent is released
    And the browser comes back online
    Then the connection is "live"
    And the agent's answer mentions "Continued after compaction."
    And the agent is idle
    And compaction continuation is diagnosed across the chat wire
    And there should be no page errors
