@scratch:chat @rows-off:codex,pi @agent-path:empty
Feature: Enabled engines explain what this machine is missing
  Background:
    Given I note this scenario's serving process
    And I open the outline "house.olai"
    And I mark the page

  # TWO ENGINES ANSWER, so the picker opens: a menu is what a person is shown
  # when there is a choice to make, and the third row is in it because an engine
  # this machine has not got is a row with a sentence rather than a row that
  # was dropped. With one startable engine the press starts it and there is no
  # menu to read, which is a different scenario and is chat's own.
  # Opencode comes from a tagged fake's search directory. It must stay
  # available beside the scenario-owned empty directory: replacing rather
  # than prepending the composed path would lose it and prevent this menu.
  @opencode
  Scenario: Installing an engine and toggling it refreshes the same tab
    When I press the agent start pill on "kitchen"
    Then the engine picker offers what this machine has and greys omp
    When I press "Escape"
    And I open the plugins panel
    Then the omp inspector row carries the picker's absence under Needs you
    When I install the fake omp in the agent search directory
    And I switch the plugin "omp" off
    And I switch the plugin "omp" on
    Then the omp inspector row no longer needs installation
    When I close the plugins panel
    And I press the agent start pill on "kitchen"
    Then the engine picker offers every engine in bundle order
    When I choose new chat engine "Oh My Pi"
    And the node agent's fold is ready
    And I ask the agent "hello after installation"
    Then the agent's answer mentions "hello after installation"
    And the engine recovery kept the same server process
    And the page has not reloaded
    And there should be no page errors

  @opencode
  Scenario: Chat withdrawal removes the scoped engine advice and return restores it
    When I press new chat in Chats
    Then the engine picker offers what this machine has and greys omp
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
    When I open the plain node composer for "install"
    Then the plain node composer has no available engine
    And the no-agent face explains the missing "omp" engine
    And the no-agent face explains the missing "claude" engine
    And there should be no page errors
