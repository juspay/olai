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
    When I open the outline "house.jsonl"
    And I hover the node "install"
    # Not "nothing was drawn": the `•••` is there to be pressed, and hovering
    # the row is not asking for a menu — it is the primitive behind the button
    # that has not been fetched.
    Then the node menu of "install" is revealed
    And nothing has asked for the menu's primitive
    And there should be no page errors

  @corpus:good
  Scenario: The first press fetches it, and the second row does not fetch it again
    When I open the outline "house.jsonl"
    And I open the node menu of "install"
    Then the node menu offers "Zoom in"
    And the menu's primitive was fetched once
    # One chunk for the whole app, not one per row: the arrival is a module
    # signal every row reads (client/arriving.ts).
    When I click away from the node menu
    And I open the node menu of "handles"
    Then the node menu offers "Zoom in"
    And the menu's primitive was fetched once
    # Same claim the rest of the client makes: this server shipped it, and no
    # CDN was asked.
    And the page requested nothing off this server
    And there should be no page errors

  @corpus:good
  Scenario: While it is on its way, the ••• is still the •••
    Given the menu's primitive is held up
    When I open the outline "house.jsonl"
    And I press the node menu of "install"
    # The button stays put in the same cell — there is no third thing to draw
    # and nothing in the gutter moves — and no panel until the chunk lands.
    Then the node menu of "install" is revealed
    And the node menu is closed
    When the menu's primitive arrives
    Then the node menu is open
    And the node menu offers "Zoom in"
    And there should be no page errors

  # A menu that never comes must say so where it was reached for. There ARE
  # page errors in this one — the failed fetch is reported in the console,
  # deliberately — so the usual step is absent.
  @corpus:good
  Scenario: If it never comes, the row says so
    Given the menu's primitive never arrives
    When I open the outline "house.jsonl"
    And I press the node menu of "install"
    Then the node menu of "install" says its menu never came
    And the node menu is closed
