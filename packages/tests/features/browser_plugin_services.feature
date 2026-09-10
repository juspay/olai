@scratch:browser-services
Feature: Browser plugins depend on plugin-owned services
  The server consumer keeps running while its browser face waits for a key.
  Approval, withdrawal and replacement settle in the same open tab.

  Scenario: A browser-only dependency follows its provider through approval and replacement
    Given I open the outline "colours.olai"
    And I mark the page
    When I open the plugins panel
    And I approve the plugin "swatch"
    Then the plugins panel says "swatch" is "palette.colours"
    And no row wears a swatch
    When I approve the plugin "palette"
    Then the row "amber" wears a swatch for "#ff8800"
    And the browser palette face is "first"
    And the agent service catalog excludes "palette.colours"
    And the browser service catalog includes "palette.colours"
    When I switch the plugin "palette" off
    Then no row wears a swatch
    And the plugins panel says "swatch" is "palette.colours"
    When I switch the plugin "palette" on
    Then the row "amber" wears a swatch for "#ff8800"
    When the browser palette provider is replaced
    Then the plugins panel says "palette" is "read the source below and approve it"
    And no row wears a swatch
    When I read the plugin "palette" again
    And I approve the plugin "palette"
    Then the row "amber" wears a swatch for "#ff8800"
    And the browser palette face is "second"
    When I switch the plugin "palette" off
    Then no row wears a swatch
    When I switch the plugin "palette" on
    Then the browser palette face is "second"
    And the page has not reloaded
    And there should be no page errors
    And no member of this page has gone silent

  Scenario: An already running browser provider serves a consumer that arrives later
    Given I open the outline "colours.olai"
    And I mark the page
    When I open the plugins panel
    And I approve the plugin "palette"
    Then no row wears a swatch
    When I approve the plugin "swatch"
    Then the browser palette face is "first"
    When I switch the plugin "swatch" off
    Then no row wears a swatch
    When I switch the plugin "swatch" on
    Then the browser palette face is "first"
    And the page has not reloaded
    And there should be no page errors
