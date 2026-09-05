@acp-session-features @scratch:chat
Feature: Node-agent progress follows its conversation across node switches
  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open

  Scenario: A background node keeps its plan while the selected node has none
    When I ask the agent "execution-plan"
    Then the execution plan contains "Inspect the outline" as "in_progress"
    When I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    Then there is no execution plan
    When I ask the agent "settings"
    Then the agent's answer mentions "reasoning=medium"
    When I press the agent "install"
    Then the agent is working
    And the execution plan contains "Inspect the outline" as "in_progress"
    And the execution plan contains "Old next step" as "pending"
    When the agent is released
    Then the agent is idle
    And the execution plan contains "Verify the changes" as "completed"
    And the execution plan omits "Old next step"
    When I press the agent "order"
    And the agent panel is open
    Then there is no execution plan
    When I press the agent "install"
    And the agent panel is open
    Then the execution plan contains "Verify the changes" as "completed"
    When I remember this conversation as "planned"
    And I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "planned"
    And there is no execution plan
    And there should be no page errors

  Scenario: Cancelling a node terminal preserves another node's completed output
    When I ask the agent "terminal live"
    Then terminal output contains "stdout ready"
    And terminal output contains "Running"
    When I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    Then there is no terminal output
    When I ask the agent "terminal truncate"
    Then the agent is idle
    And terminal output contains "éEND"
    And terminal output contains "Exit 7"
    And terminal output omits "stdout ready"
    When I press the agent "install"
    Then the agent is working
    And terminal output contains "stdout ready"
    And terminal output contains "Running"
    And terminal output omits "éEND"
    When I cancel the turn
    Then the agent is idle
    And terminal output contains "SIGTERM"
    When I press the agent "order"
    And the agent panel is open
    Then terminal output contains "éEND"
    And terminal output contains "Exit 7"
    And terminal output omits "SIGTERM"
    And there should be no page errors
