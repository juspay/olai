@codex @scratch:chat
Feature: A Codex chat is opened as it always was, whatever chat's compaction settings say
  Chat's `auto-compact` switch and `compact-at` size tell only an engine that
  can be told where to compact. By default `compact-at` is `model-limit`, which
  sends no engine anything, so this scenario sets a size first: with chat set
  to compact at `200k`, a Codex session open still carries no compaction
  settings at all, because Codex registers no way to be told. The size is
  written while the server is down, so the serve that opens the agent reads it
  from its first moment. The fake answers `compaction <label>` with what its
  last session open said.

  Scenario: With a size set for chat, the Codex agent is told nothing about compaction
    Given the server stops
    And I write "200k" for the "chat" setting "compact-at" on disk
    And the server starts again on the same port
    And I open the app
    And I open the plugins panel
    And the "chat" setting "compact-at" shows "200k" pressed
    And I close the plugins panel
    And I show the done nodes
    And I open the outline "house.olai"
    And I open the "codex" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "compaction codex"
    Then the agent is idle
    And the agent's answer mentions "compaction codex: not set"
