@acp-session-features @scratch:chat
Feature: Session settings belong to the node conversation that offered them
  Scenario: Two node agents keep independent settings
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I open the session settings
    And I set session setting "Reasoning" to "high"
    And I enable fast mode
    And I open the session settings
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "settings"
    Then the agent's answer mentions "reasoning=medium, mode=code, fast=false"
    When I press the agent "install"
    And the agent panel is open
    And I ask the agent "settings"
    Then the agent's answer mentions "reasoning=high, mode=code, fast=true"
    When I remember this conversation as "configured"
    And I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "configured"
    And the panel header names the node agent "install the cabinets"
    When I ask the agent "settings"
    Then the agent's answer mentions "reasoning=medium, mode=code, fast=false"
    And there should be no page errors

  Scenario: Settings from a delayed tab cannot change the newly selected node
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I open the session settings
    And I hold incoming updates to the original browser tab
    And I open another browser tab
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I use the original browser tab
    And I attempt session setting "Reasoning" to "high"
    And I release incoming updates to the original browser tab
    Then the panel refuses, saying "wait for this conversation to be idle"
    When I use the other browser tab
    And I ask the agent "settings"
    Then the agent's answer mentions "reasoning=medium, mode=code, fast=false"
    When I press the agent "install"
    And the agent panel is open
    And I open the session settings
    Then session setting "Reasoning" is "medium"
    When I set session setting "Reasoning" to "high"
    And I open the session settings
    And I ask the agent "settings"
    Then the agent's answer mentions "reasoning=high"
    And there should be no page errors
