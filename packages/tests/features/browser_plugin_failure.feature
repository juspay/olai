@scratch:browser-services-failed
Feature: Browser initialization failures are visible
  A server declaration is discoverable even if this tab cannot activate it.

  Scenario: A failed browser provider names its fault and recovers after repair
    Given I open the outline "colours.olai"
    And I mark the page
    # Approving walks to the plugin's own page and back, so the panel is
    # opened on the other side of both approvals.
    When I approve the plugin "swatch"
    And I approve the plugin "palette"
    And I open the plugins panel
    Then the plugins panel says "palette" is "In this tab: failed to start. palette initialization failed"
    And the plugins panel says "swatch" is "palette.colours"
    And the browser service catalog includes "palette.colours"
    When I close the plugins panel
    Then no row wears a swatch
    When the browser palette initialization is repaired
    And I open the plugins panel
    Then the plugin "palette" is off without prose
    When I close the plugins panel
    And I approve the plugin "palette"
    Then the browser palette face is "first"
    When I open the plugins panel
    Then the plugin "palette" has no browser warning
    And the plugin "swatch" has no browser warning
    When I close the plugins panel
    Then the browser has reported the palette initialization failure
    And the page has not reloaded
    And there should be no page errors
