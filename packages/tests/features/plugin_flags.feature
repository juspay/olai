Feature: File policy chooses the rows that run
  The scratch vault authors on: yes or on: no in _olai/Settings.olai.
  The panel reads those choices and a switch edits the same file.

  @scratch:lanes @rows-on:xyne-spaces
  Scenario: File policy turns an opt-in row on
    Given I open the outline "lanes.olai"
    When I open the plugins panel
    Then the plugin "xyne-spaces" has authored enablement "yes"
    And the plugin "xyne-spaces" is running
    And the plugins panel says nothing more about "journal"

  @scratch:lanes @rows-off:journal
  Scenario: File policy turns a default row off
    Given I open the outline "lanes.olai"
    When I open the plugins panel
    Then the plugins panel says "journal" is "Settings.olai says on: no"

  @scratch:lanes @rows-on:xyne-spaces @rows-off:journal
  Scenario: Independent row choices compose
    Given I open the outline "lanes.olai"
    When I open the plugins panel
    Then the plugin "xyne-spaces" has authored enablement "yes"
    And the plugin "xyne-spaces" is running
    And the plugins panel says "journal" is "Settings.olai says on: no"

  @scratch:good @rows-off:mcp
  Scenario: File policy removes a transport while preserving browser control
    When I open the app
    And I open the plugins panel
    Then the plugins panel says "mcp" is "Settings.olai says on: no"
    And the MCP transport answers with status 404
    And the browser build answers with status 200
    When I switch the plugin "mcp" on
    Then the MCP transport answers with status 200
    And there should be no page errors
