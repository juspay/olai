@codex @scratch:chat
Feature: A Codex chat is opened as it always was, whatever chat's compaction settings say
  Chat's `auto-compact` switch tells only an engine that can be told where to
  compact. Codex registers no way to be told, so with the switch on — its
  default — a Codex session open carries no compaction settings at all. The
  fake answers `compaction <label>` with what its last session open said.

  Scenario: With auto-compact on, the Codex agent is told nothing about compaction
    Given I open the app
    And I show the done nodes
    And I open the outline "house.olai"
    And I open the "codex" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "compaction codex"
    Then the agent is idle
    And the agent's answer mentions "compaction codex: not set"
