@scratch:good
Feature: The renderer and layout are browser rows
  Host selection and browser activation are separate facts. Removing either
  browser owner removes its UI while independent server capabilities survive.

  Scenario Outline: Removing a shell owner leaves the headless vault available
    When I open the app
    And I open the plugins panel
    Then the plugins panel says "<owner>" is "Selected by the host"
    And the plugins panel says "<owner>" is "Browser: running."
    When I request that the plugin "<owner>" be off
    Then the browser mount has no rendered application
    And the MCP vault can read an outline
    And the MCP transport answers with status 200
    And there should be no page errors

    Examples:
      | owner       |
      | layout      |
      | ui-renderer |
