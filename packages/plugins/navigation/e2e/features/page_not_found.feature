@corpus:good
Feature: An address that names nothing says so, and offers the way home
  A mistyped address, a link to a file somebody since deleted, a file of a
  kind no row reads: each lands on a page that has nothing to show. That page
  says `Page not found`, says in one plain line what was asked for, and offers
  `Go home` — never a blank pane, and never a dead end.

  Two owners draw it. An address of a kind a row claims (an outline that does
  not exist) is that row's own page, which knows the noun; an address no row
  claims is navigation's, which knows only the suffix. Both say the same
  heading and offer the same way out.

  Scenario: An outline that does not exist is not found, and Go home leaves it
    When I open the address "/nowhere.olai"
    Then the empty page says "Page not found" over "There is no outline named nowhere.olai."
    And the empty page "Page not found" offers "Go home"
    When I mark the page
    And I press "Go home" on the empty page "Page not found"
    Then the address is "/"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A file of a kind nothing reads says which kind, and Go home leaves it
    When I open the address "/notes.xyz"
    Then the empty page says "Page not found" over "olai can't open .xyz files."
    And the empty page "Page not found" offers "Go home"
    When I mark the page
    And I press "Go home" on the empty page "Page not found"
    Then the address is "/"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A name with no suffix names no page, and opens the front page
    # An address the grammar cannot read as a file names no page at all, and
    # the router's kindness for that is the front page rather than a dead end
    # (`../../src/routes.ts`'s `routeOfIn`, held by `routes.test.ts`): only an
    # address that names a FILE can be a file that is not there.
    When I open the address "/no-such-thing"
    Then the focused pane is drawing the outline "Daily/2026-08.olai"
    And there should be no page errors
