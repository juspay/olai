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

  Scenario: An optional module failing during cold startup leaves the shell usable
    Given the browser module for "pi" cannot be fetched
    When I open the app
    And I open the plugins panel
    Then the plugins panel says "pi" is "Module load failed"
    Given I mark the page
    When the browser module can be fetched again
    And I retry the failed browser activation
    Then the browser activation has recovered
    And the page has not reloaded
    And there should be no page errors

  Scenario: A renderer module failure has a startup diagnostic and can recover
    Given the browser module for "ui-renderer" cannot be fetched
    When I open the app
    Then browser startup reports its failure
    Given I mark the page
    When the browser module can be fetched again
    And I retry browser startup
    And I open the plugins panel
    Then the plugins panel says "ui-renderer" is "Browser: running."
    And the page has not reloaded
    And there should be no page errors
