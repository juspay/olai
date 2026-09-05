@scratch:good
Feature: Transports are rows
  The web profile mounts the browser socket and MCP independently. Turning the
  MCP row off removes its endpoint while the browser keeps the control needed
  to turn it back on.

  Scenario: The plugins panel removes and restores the MCP endpoint
    When I open the app
    And I open the plugins panel
    Then the MCP transport answers with status 200
    When I switch the plugin "mcp" off
    Then the MCP transport answers with status 404
    When I switch the plugin "mcp" on
    Then the MCP transport answers with status 200
    When I switch the plugin "mcp" off
    And I switch the plugin "mcp" on
    Then the MCP transport answers with status 200
    And there should be no page errors
