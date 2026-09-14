@scratch:good
Feature: The vault is a row
  The vault switch closes the directory while the control panel stays available.
  Turning it on opens a fresh store over the same files.

  Scenario: Withdraw and reopen the vault twice through the plugins panel
    Given I open the outline "garden.olai"
    Then the node "mint" is shown
    When I open the plugins panel
    Then the plugins panel shows "vault" configured "format" as "outline-olai"
    And the plugin "vault" has a session-only switch ring
    When I switch the plugin "vault" off
    Then the node "mint" is not shown
    And the MCP vault refuses a write because no directory is served
    And chat controls are gone-from the outline
    When I switch the plugin "vault" on
    Then the node "mint" is shown
    And the MCP vault can read an outline
    And chat controls are in the outline
    When I switch the plugin "vault" off
    Then the MCP vault refuses a write because no directory is served
    When I switch the plugin "vault" on
    Then the MCP vault can read an outline
    And there should be no page errors

  @rows-off:vault,settings
  Scenario: File enablement cannot lock the reader infrastructure out
    Given I open the outline "garden.olai"
    Then the node "mint" is shown
    When I open the plugins panel
    Then the plugin "vault" is running
    And the plugin "settings" is running
    And the plugin "vault" has a session-only switch ring
    When I switch the plugin "vault" off
    Then the MCP vault refuses a write because no directory is served
    When I switch the plugin "vault" on
    Then the MCP vault can read an outline
    And the plugin "settings" is running
    When I switch the plugin "settings" off
    Then every plugin enable switch has a session-only ring
    When I switch the plugin "settings" on
    Then the plugin "settings" is running
    And the plugin "vault" is running
    And there should be no page errors
