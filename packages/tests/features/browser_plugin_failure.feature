@scratch:browser-services-failed
Feature: Browser initialization failures are visible
  A server declaration is discoverable even if this tab cannot activate it.

  Scenario: A failed browser provider names its fault and recovers after repair
    Given I open the outline "colours.olai"
    And I mark the page
    When I open the plugins panel
    And I approve the plugin "swatch"
    And I approve the plugin "palette"
    Then the plugins panel says "palette" is "Browser: failed to start. palette initialization failed"
    And the plugins panel says "swatch" is "palette.colours"
    And no row wears a swatch
    And the browser service catalog includes "palette.colours"
    When the browser palette initialization is repaired
    Then the plugins panel says "palette" is "read the source below and approve it"
    When I read the plugin "palette" again
    And I approve the plugin "palette"
    Then the browser palette face is "first"
    And the plugin "palette" has no browser warning
    And the plugin "swatch" has no browser warning
    And the browser has reported the palette initialization failure
    And the page has not reloaded
    And there should be no page errors
