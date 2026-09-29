@corpus:good
Feature: ⌘J is the browser's again
  ⌘J / Ctrl+J used to show or hide the agent panel, docked beside the page.
  The dock left — an agent's conversation lives on the row it was started
  from — and the chord and its palette row left with it. Nothing in the app
  answers ⌘J now, the shortcuts sheet does not list it, and the palette offers
  no panel to toggle. The one width command left is the sidebar's.

  Scenario: Pressing ⌘J does nothing in the app
    Given I open the outline "house.olai"
    And I mark the page
    When I press the old agent-panel chord
    Then the app left the chord to the browser
    And the page has not reloaded
    And there should be no page errors

  Scenario: The shortcuts sheet lists no ⌘J
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "keyboard shortcuts" into the palette
    And I choose "Keyboard shortcuts" from the palette
    Then the shortcuts are showing
    And the shortcuts list no chord with J
    And there should be no page errors

  Scenario: The palette offers no agent panel, and resets only the sidebar's width
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "toggle" into the palette
    Then the palette offers "Toggle sidebar"
    And the palette does not offer "Toggle agent panel"
    When I type "reset" into the palette
    Then the palette offers "Reset sidebar width"
    And the palette does not offer "Reset panel widths"
    And there should be no page errors
