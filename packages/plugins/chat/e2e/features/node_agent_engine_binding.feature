Feature: A node's engine is the one its panel acts on

  @codex @scratch:chat
  Scenario: The fresh-start menu opens on the engine this node already runs
    Given I open the outline "house.olai"
    When I open the "codex" agent on node "kitchen"
    And the node agent's fold is ready
    And I open the fresh-session engine menu
    Then the engine menu offers "codex" first, above "claude"

  @opencode @scratch:chat
  Scenario: A node whose engine has gone refuses a fresh start rather than changing engine
    Given I open the outline "house.olai"
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I remember this conversation as "opencode kitchen"
    And I mark the page
    When I open the plugins panel
    And I switch the plugin "opencode" off
    And I close the plugins panel
    And I start a fresh session
    Then the fresh-session control refuses "opencode" and allows retry
    And node "kitchen" still binds remembered conversation "opencode kitchen" in "house.olai"
    And the page has not reloaded
    And there should be no page errors

  @scratch:chat
  Scenario: A node bound to an engine this machine has not got is told about that engine
    Given node "install" in "house.olai" names the "omp" engine with no session
    And I open the plain node composer for "install"
    Then the plain node composer explains the missing "omp" engine
    And the plain node composer draws no machine-wide engine absence
    And there should be no page errors
