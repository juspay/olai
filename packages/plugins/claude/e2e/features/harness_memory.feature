@claude @scratch:chat
Feature: The harness's own memory is switched off under olai
  The node's subtree is the only memory, and a second one the panel cannot
  see would drift from it. The switch is an environment variable on the
  adapter's spawn, set unconditionally — so the fake answers `memory` with
  what its own spawn saw, which is the one reading that proves the switch
  crossed rather than a fact about CI.

  The harness also sets the OPERATOR'S CONTRARY VALUE on this server
  (the descriptor's `env`): an operator who exported `CLAUDE_CODE_DISABLE_AUTO_MEMORY=0`
  must still find the adapter with memory off, because the engine's answer
  wins over olai's own environment.

  Background:
    Given I open the app
    And I show the done nodes
    And I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  Scenario: The adapter's spawn reports its own memory off, over the operator's export
    When I ask the agent "memory"
    Then the agent is idle
    And the agent's answer mentions "harness memory: off (auto memory disabled)"