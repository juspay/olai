@scratch:good
Feature: The vault is a row
  The vault switch closes the directory while the control panel stays available.
  Turning it on opens a fresh store over the same files.

  Scenario: Withdraw and reopen the vault twice through the plugins panel
    Given I open the outline "garden.olai"
    Then the node "mint" is shown
    When I open the plugins panel
    Then the plugins panel shows "vault" configured "format" as "olai"
    And the plugins panel says "vault" is "Turning it off clears the served files"
    When I switch the plugin "vault" off
    Then the node "mint" is not shown
    And the MCP vault refuses a write because no directory is served
    And the conversation is gone-from the header
    When I switch the plugin "vault" on
    Then the node "mint" is shown
    And the MCP vault can read an outline
    And the conversation is in the header
    When I switch the plugin "vault" off
    Then the MCP vault refuses a write because no directory is served
    When I switch the plugin "vault" on
    Then the MCP vault can read an outline
    And there should be no page errors

  @plugins:ws,web-app,mcp,ui-renderer,layout,sidebar,preferences,theme,plugin-inspector,navigation,outlines,markdown,files,pins,capture,trash,vault-plugins
  Scenario: A transport-only selection can enable the vault from the control panel
    Given I open the app
    When I open the plugins panel
    Then the plugins panel says "vault" is "was not asked for"
    And the MCP vault refuses a write because no directory is served
    When I switch the plugin "vault" on
    Then the plugins panel says "vault" is "Turning it off clears the served files"
    And the MCP vault can read an outline
    When I switch the plugin "vault" off
    Then the MCP vault refuses a write because no directory is served
    And there should be no page errors
