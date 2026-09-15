@corpus:good
Feature: Tabs above the panes
  Several pages stay open as tabs in the main column. The tab in front is the
  page the address bar shows: a door, Back and every pane verb act on it, and a
  tab in the background keeps its page, its filter and its place.

  Scenario: Opening the app shows one tab holding the address, in front
    Given I open the outline "house.olai"
    Then there is 1 tab
    And tab 0 is in front
    And tab 0 holds "/house.olai"
    And the tab strip reads the address "/house.olai"
    And there should be no page errors

  Scenario: Following a door changes the tab in front and keeps the count
    Given I open the outline "house.olai"
    When I click the outline "garden.olai"
    Then there is 1 tab
    And tab 0 holds "/garden.olai"
    And the tab strip reads the address "/garden.olai"
    And there should be no page errors

  Scenario: Open in new tab from a link's menu adds a tab behind
    Given I open the outline "house.olai"
    And I mark the page
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    Then there are 2 tabs
    And tab 0 is in front
    And tab 1 holds "/garden.olai"
    And the address is "/house.olai"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Open from a link's menu follows the link in the tab in front
    Given I open the outline "house.olai"
    When I choose "Open" from the menu of the outline link "garden.olai"
    Then there is 1 tab
    And the address is "/garden.olai"
    And there should be no page errors

  Scenario: Pressing a tab brings it to the front
    Given I open the outline "house.olai"
    And I mark the page
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    Then tab 1 is in front
    And the address is "/garden.olai"
    And the sidebar marks the outline "garden.olai" as the one open
    And tab 0 holds "/house.olai"
    When I press tab 0
    Then the address is "/house.olai"
    And the sidebar marks the outline "house.olai" as the one open
    And the page has not reloaded
    And there should be no page errors

  Scenario: Closing the tab in front shows its right neighbour, else its left
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "Daily/2026-08.olai"
    And I choose "Open in new tab" from the menu of the outline link "garden.olai"
    Then the tabs hold "/house.olai /garden.olai /Daily/2026-08.olai"
    When I close tab 0 with its button
    Then there are 2 tabs
    And tab 0 is in front
    And the address is "/garden.olai"
    When I press tab 1
    And I close tab 1 with its button
    Then there is 1 tab
    And tab 0 is in front
    And the address is "/garden.olai"
    And there should be no page errors

  Scenario: Closing the last tab leaves a front-page tab
    Given I open the outline "house.olai"
    When I close tab 0 with its button
    Then there is 1 tab
    And tab 0 is in front
    And tab 0 holds "/"
    And the address is "/"
    And there should be no page errors

  Scenario: Middle-click closes, Duplicate copies, Close other tabs leaves one
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I middle-click tab 1
    Then there is 1 tab
    When I choose "Duplicate tab" from the menu of tab 0
    Then there are 2 tabs
    And tab 1 is in front
    And the tabs hold "/house.olai /house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I choose "Close other tabs" from the menu of tab 2
    Then there is 1 tab
    And tab 0 holds "/garden.olai"
    And the address is "/garden.olai"
    And there should be no page errors

  Scenario: The plus opens a front-page tab in front
    Given I open the outline "house.olai"
    When I press the new tab button
    Then there are 2 tabs
    And tab 1 is in front
    And tab 1 holds "/"
    And the address is "/"
    And there should be no page errors

  Scenario: Dragging reorders the tabs, and the order survives a reload
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I drag tab 0 onto tab 1
    Then the tabs hold "/garden.olai /house.olai"
    And tab 1 is in front
    When I reload the page
    Then the tabs hold "/garden.olai /house.olai"
    And tab 1 is in front
    And the address is "/house.olai"
    And there should be no page errors

  Scenario: The tab chords switch, open and close, and the shortcuts sheet lists them
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press the "next tab" chord
    Then tab 1 is in front
    And the address is "/garden.olai"
    When I press the "next tab" chord
    Then tab 0 is in front
    When I press the "previous tab" chord
    Then tab 1 is in front
    When I press the "new tab" chord
    Then there are 3 tabs
    And tab 2 is in front
    And the address is "/"
    When I press the "close tab" chord
    Then there are 2 tabs
    And tab 1 is in front
    When I press the palette shortcut
    And I type "keyboard shortcuts" into the palette
    And I choose "Keyboard shortcuts" from the palette
    Then the shortcuts are showing
    And the shortcuts list "show the next tab" as "⌘⇧. / Ctrl+⇧."
    And the shortcuts list "show the previous tab" as "⌘⇧, / Ctrl+⇧,"
    And the shortcuts list "open a new tab on the front page" as "⌘⇧O / Ctrl+⇧O"
    And the shortcuts list "close the tab in front" as "⌘⇧X / Ctrl+⇧X"
    And there should be no page errors

  Scenario: A split stays inside its tab
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I alt-click the zoom of "install"
    Then there are 2 panes
    And there are 2 tabs
    And tab 0 holds "/s/house.olai/%23install?f=1"
    And tab 0 is titled "house.olai + install"
    When I press tab 1
    Then there are 1 panes
    And the address is "/garden.olai"
    When I press tab 0
    Then there are 2 panes
    When I close the focused pane
    Then there are 1 panes
    And there are 2 tabs
    And tab 0 holds "/house.olai"
    And there should be no page errors

  Scenario: The filter typed in one tab is absent from another and back on return
    Given I open the outline "house.olai"
    When I filter the page by "hinges"
    And I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    Then the address is exactly "/garden.olai"
    When I press tab 0
    Then the address is exactly "/house.olai?q=hinges"
    And the filter box holds "hinges"
    And the outline has 3 rows
    And there should be no page errors
