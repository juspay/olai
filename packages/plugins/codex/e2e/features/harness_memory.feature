@codex @scratch:chat
Feature: The harness's own memory is switched off under olai
  The node's subtree is the only memory, and a second one the panel cannot
  see would drift from it. Codex's `features.memories` lives in a
  `CODEX_CONFIG` JSON overlay the adapter merges into its session config, so
  the switch is a merge: every key the operator set must survive, and only
  `features.memories` is forced false.

  The harness also sets the OPERATOR'S CONTRARY CONFIG on this server (the
  descriptor's `env`): memory enabled plus a `model` key. The fake answers
  `memory` with what its own spawn saw, which is the one reading that proves
  the merged overlay crossed — memory off, the other key intact.

  Background:
    Given I open the app
    And I show the done nodes
    And I open the outline "house.olai"
    And I open the "codex" agent on node "kitchen"
    And the node agent's fold is ready

  Scenario: The adapter's spawn reports memory off and the operator's keys intact
    When I ask the agent "memory"
    Then the agent is idle
    And the agent's answer mentions "harness memory: off (features.memories=false, kept model=gpt-5)"