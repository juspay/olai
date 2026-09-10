Feature: Extra and without plugin flags
  `--plugins` is still the exact set. `--extra-plugins` turns on a row the
  build ships off, and `--without-plugins` turns off a row the build ships
  on. The two compose with the default and with each other; the exact set
  does not compose with either. The plugins panel names the flag that
  decided each row.

  @scratch:lanes @extra-plugins:xyne-spaces
  Scenario: Extra-plugins turns an opt-in row on, and the panel says why
    Given I open the outline "lanes.olai"
    When I open the plugins panel
    Then the plugins panel says "xyne-spaces" is "--extra-plugins"
    And the plugins panel was started "--extra-plugins=xyne-spaces"
    And the plugins panel says nothing more about "journal"

  @scratch:lanes @without-plugins:journal
  Scenario: Without-plugins turns a default row off, and the panel says which flag
    Given I open the outline "lanes.olai"
    When I open the plugins panel
    Then the plugins panel says "journal" is "--without-plugins"
    And the plugins panel was started "--without-plugins=journal"

  @scratch:lanes @extra-plugins:xyne-spaces @without-plugins:journal
  Scenario: Extra and without compose with each other
    Given I open the outline "lanes.olai"
    When I open the plugins panel
    Then the plugins panel says "xyne-spaces" is "--extra-plugins"
    And the plugins panel says "journal" is "--without-plugins"
    And the plugins panel was started "--extra-plugins=xyne-spaces"
    And the plugins panel was started "--without-plugins=journal"

  @scratch:good @without-plugins:mcp
  Scenario: Without-plugins removes a transport while preserving browser control
    When I open the app
    And I open the plugins panel
    Then the plugins panel says "mcp" is "--without-plugins"
    And the MCP transport answers with status 404
    And the browser build answers with status 200
    When I switch the plugin "mcp" on
    Then the MCP transport answers with status 200
    And there should be no page errors
