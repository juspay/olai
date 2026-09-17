@scratch:chat @rows-off:codex,pi,opencode
Feature: Enabled engines explain what this machine is missing
  Background:
    Given the agent search directory is empty
    And I open the outline "house.olai"
    And I mark the page

  Scenario: Installing an engine and toggling it refreshes the same tab
    When I press the agent start pill on "kitchen"
    Then the engine picker has Claude available and omp missing
    When I press "Escape"
    And I open the plugins panel
    Then the omp inspector row carries the picker's absence under Needs you
    When I install the fake omp in the agent search directory
    And I switch the plugin "omp" off
    And I switch the plugin "omp" on
    Then the omp inspector row no longer needs installation
    When I close the plugins panel
    And I press the agent start pill on "kitchen"
    Then the engine picker has both engines available in bundle order
    When I choose new chat engine "Oh My Pi"
    And the node agent's fold is ready
    And I ask the agent "hello after installation"
    Then the agent's answer mentions "hello after installation"
    And the engine recovery kept the same server process
    And the page has not reloaded
    And there should be no page errors

  Scenario: Chat withdrawal removes the scoped engine advice and return restores it
    When I press new chat in Chats
    Then the engine picker has Claude available and omp missing
    When I press "Escape"
    And I open the plugins panel
    And I switch the plugin "chat" off
    Then no engine installation advice is drawn in the inspector
    When I request that the plugin "omp" be on
    Then the plugins panel says "omp" is "Waiting for agents"
    And no engine installation advice is drawn in the inspector
    When I switch the plugin "chat" on
    Then the omp inspector row carries the picker's absence under Needs you
    And the page has not reloaded
    And there should be no page errors

  @no-agent
  Scenario: An all-missing table still explains each enabled engine
    When I open the plain node composer for "kitchen"
    Then the plain node composer has no available engine
    And the no-agent face explains the missing "omp" engine
    And the no-agent face explains the missing "claude" engine
    And there should be no page errors
