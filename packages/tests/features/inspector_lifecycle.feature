@scratch:good
Feature: The inspector is a consumer of independent host management
  Background:
    Given the vault defines a non-UI host management controller
    And I open the outline "house.olai"
    And I open the plugins panel
    And I approve the plugin "management-controller"
    And I mark the page

  Scenario: The inspector can remove itself and authorized non-UI control can restore it
    When I request that the plugin "plugin-inspector" be off
    Then the inspector has no rendered controls or panel
    And the MCP vault can read an outline
    When the non-UI controller sets plugin "plugin-inspector" on
    Then the inspector panel is closed
    When I open the plugins panel
    Then the plugins panel says nothing more about "plugin-inspector"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Inspector state survives replacement of its shell
    When the non-UI controller sets plugin "layout" off
    Then the browser mount has no rendered application
    When the non-UI controller sets plugin "layout" on
    Then the plugins panel says nothing more about "layout"
    And the plugins panel says nothing more about "plugin-inspector"
    And the page has not reloaded
    And there should be no page errors
