Feature: The ••• menu's primitive arrives when a row is asked for its menu
  The menu is `@kobalte/core`'s DropdownMenu — being open, where the panel
  goes, the pointer outside that shuts it, Escape, and the arrow keys that walk
  the list — and that is ~80 kB raw / ~23 kB brotli of a client whose first
  paint draws none of it: an outline is titles, checkboxes and badges, and the
  `•••` beside a row is three characters in a `<button>`.

  So the primitive is a chunk of its own, fetched the first time somebody
  reaches for a menu. What is proved here is both halves: a page nobody opens a
  menu on never asks for it, and a page that does ask goes on drawing the same
  `•••` in the same cell while it is on its way — and says so if it never
  comes.

  It is the second cost of the same ask. The first is per ROW and is runtime (a
  shut DropdownMenu is an IntersectionObserver, a timer and a few dozen signals
  per row, which is why a row mounts nothing until it is asked); this one is per
  APP and is bytes. Both fall due on the first press, and `menu_panel.feature`
  is where the panel's own behaviour is held.

  @corpus:good
  Scenario: An outline paints without fetching the menu
    When I open the outline "house.olai"
    And I hover the node "install"
    Then the node menu of "install" is revealed
    And nothing has asked for the menu's primitive
    And there should be no page errors

  @corpus:good
  Scenario: The first press fetches it, and no row after that fetches it again
    When I open the outline "house.olai"
    And I open the node menu of "install"
    Then the node menu offers "Zoom in"
    And the menu's primitive was fetched once
    When I click away from the node menu
    And I open the node menu of "handles"
    Then the node menu offers "Zoom in"
    And the menu's primitive was fetched once
    When I click away from the node menu
    And I open the node menu of "hinges"
    Then the node menu offers "Zoom in"
    And the menu's primitive was fetched once
    And the page requested nothing off this server
    And there should be no page errors

  @corpus:good
  Scenario: While it is on its way, the ••• is still the •••
    Given the menu's primitive is held up
    When I open the outline "house.olai"
    And I press the node menu of "install"
    Then the node menu of "install" is revealed
    And the node menu is closed
    When the menu's primitive arrives
    Then the node menu is open
    And the node menu offers "Zoom in"
    And there should be no page errors

  @corpus:good
  Scenario: If it never comes, the row says so
    Given the menu's primitive never arrives
    When I open the outline "house.olai"
    And I press the node menu of "install"
    Then the node menu of "install" says its menu never came
    And the node menu is closed

  @corpus:good
  Scenario: Changing your mind inside the window does not cancel the ask
    Given the menu's primitive is held up
    When I open the outline "house.olai"
    And I press the node menu of "install"
    And I click away from the node menu
    And I press "Escape"
    Then the node menu is closed
    When the menu's primitive arrives
    Then the node menu is open
    When I press "Escape"
    Then the node menu is closed
    And there should be no page errors
