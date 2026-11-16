@scratch:browser-services
Feature: Browser plugins depend on plugin-owned services
  The server consumer keeps running while its browser face waits for a key.
  Approval, withdrawal and replacement settle in the same open tab.

  APPROVING WALKS TO THE PLUGIN'S OWN PAGE AND BACK, which is a navigation and
  takes the plugins panel with it — so the panel is opened on the other side of
  every approval here, and closed again where the next claim is about the
  OUTLINE (a chip is drawn on a row, behind the panel).

  Scenario: A browser-only dependency follows its provider through approval and replacement
    Given I open the outline "colours.olai"
    And I mark the page
    When I approve the plugin "swatch"
    And I open the plugins panel
    Then the plugins panel says "swatch" is "palette.colours"
    When I close the plugins panel
    Then no row wears a swatch

    When I approve the plugin "palette"
    Then the row "amber" wears a swatch for "#ff8800"
    And the browser palette face is "first"
    And the agent service catalog excludes "palette.colours"
    And the browser service catalog includes "palette.colours"

    When I open the plugins panel
    And I switch the plugin "palette" off
    Then the plugins panel says "swatch" is "palette.colours"
    When I close the plugins panel
    Then no row wears a swatch

    When I open the plugins panel
    And I switch the plugin "palette" on
    And I close the plugins panel
    Then the row "amber" wears a swatch for "#ff8800"

    When the browser palette provider is replaced
    And I open the plugins panel
    Then the plugin "palette" is off without prose
    When I close the plugins panel
    Then no row wears a swatch
    When I approve the plugin "palette"
    Then the row "amber" wears a swatch for "#ff8800"
    And the browser palette face is "second"

    When I open the plugins panel
    And I switch the plugin "palette" off
    And I close the plugins panel
    Then no row wears a swatch
    When I open the plugins panel
    And I switch the plugin "palette" on
    And I close the plugins panel
    Then the browser palette face is "second"
    And the page has not reloaded
    And there should be no page errors
    And no member of this page has gone silent

  Scenario: An already running browser provider serves a consumer that arrives later
    Given I open the outline "colours.olai"
    And I mark the page
    When I approve the plugin "palette"
    Then no row wears a swatch
    When I approve the plugin "swatch"
    Then the browser palette face is "first"

    When I open the plugins panel
    And I switch the plugin "swatch" off
    And I close the plugins panel
    Then no row wears a swatch
    When I open the plugins panel
    And I switch the plugin "swatch" on
    And I close the plugins panel
    Then the browser palette face is "first"
    And the page has not reloaded
    And there should be no page errors
