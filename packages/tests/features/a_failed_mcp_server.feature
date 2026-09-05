Feature: Actual MCP connection failures are visible
  Kolu is handed to the agent without a disposable preflight connection.
  Until the agent reports health, the panel lists the command as unconfirmed.
  Claude's scripted adapter reports connection status on the next turn's init,
  so the attach command below changes what the following turn reports.

  Background:
    Given I open the app
    And the agent panel is open

  @scratch:chat
  Scenario: A failed connection is named with the adapter's reason
    Then the panel says this conversation has "kolu"
    And the panel does not claim the agent attached "kolu"
    When I ask the agent "attach kolu failed"
    Then the agent is idle
    When I ask the agent "hello"
    Then the agent is idle
    And the panel says the agent could not attach "kolu"
    And the reason it gives is "failed"
    And it names the configured executable

  @scratch:chat
  Scenario: Connection status is established again for a new conversation
    When I ask the agent "attach kolu failed"
    Then the agent is idle
    When I ask the agent "hello"
    Then the agent is idle
    And the panel says the agent could not attach "kolu"
    When I start a new conversation
    Then the chat is empty
    And the panel says this conversation has "kolu"
    And the panel does not claim the agent attached "kolu"

  @phone @scratch:chat
  Scenario: A phone shows the same actual connection failure
    When I ask the agent "attach kolu failed"
    Then the agent is idle
    When I ask the agent "hello"
    Then the agent is idle
    And the panel says the agent could not attach "kolu"
    And the reason it gives is "failed"

  @scratch:chat @kolu
  Scenario: A recovered connection clears the failure
    When I ask the agent "attach kolu failed"
    Then the agent is idle
    When I ask the agent "hello"
    Then the agent is idle
    And the panel says the agent could not attach "kolu"
    When I ask the agent "attach kolu connected"
    Then the agent is idle
    When I ask the agent "servers"
    Then the agent's answer mentions "servers: [olai kolu odu]"
    And the panel says the agent attached "kolu"
    And the panel says nothing about a missing server
