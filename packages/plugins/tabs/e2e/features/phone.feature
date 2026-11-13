@corpus:good
Feature: Tabs on a phone
  Below the desktop breakpoint there is no strip. The set is kept, and written,
  but not drawn or driven.

  The breakpoint answers ONE question — is there room for a strip — and the
  last scenario is the screen that answers it yes without having a pointer:
  the same handset context, widened, which is a tablet in landscape. What it
  used to get was a row of tabs whose close buttons were revealed by a gesture
  it cannot make.

  @phone
  Scenario: No strip, and the pane strip still appears for a split
    Given I open the outline "house.olai"
    Then there is no tab strip
    And the main-column reserve equals the visible chrome
    When I alt-click the zoom of "install"
    Then the pane tabs are shown
    And there is no tab strip
    And there should be no page errors

  @phone
  Scenario: The chords do nothing, and Open in new tab shows the page in place
    Given I open the outline "house.olai"
    When I press the "new tab" chord
    Then the address is "/house.olai"
    And the stored tabs hold "(front)"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    Then the address is "/garden.olai"
    And the stored tabs hold "/house.olai (front)"
    When I press the "previous tab" chord
    Then the address is "/garden.olai"
    # No lane on a phone: Back is the window's, and returns to the page before.
    When I go back
    Then the address is "/house.olai"
    And there should be no page errors

  Scenario: A set stored on a desk is still stored after a phone visit
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    Then the stored tabs hold "(front) /garden.olai"
    When I shrink the window to a phone
    And I open the address "/finishes.md"
    Then there is no tab strip
    And the main-column reserve equals the visible chrome
    And the stored tabs hold "(front) /garden.olai"
    When I widen the window to a desk
    Then the main-column reserve equals the visible chrome
    When I reload the page
    Then the tabs hold "/finishes.md /garden.olai"
    And there should be no page errors

  @phone
  Scenario: A wide touch screen gets the strip, and a background tab closes with a thumb
    Given I open the outline "house.olai"
    When I widen the window to a desk
    Then there is 1 tab
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    Then there are 2 tabs
    # The background tab's `×`: the front tab's is always drawn, and the others'
    # waited on a hover. Opacity is the claim — a transparent button is still a
    # button Playwright would call visible and a thumb would land on blindly.
    And tab 1 shows its close control without a hover
    When I tap the close control of tab 1
    Then there is 1 tab
    And the address is "/house.olai"
    And there should be no page errors
