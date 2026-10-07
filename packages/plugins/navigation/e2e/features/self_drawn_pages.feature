@scratch:good
@rows-on:test-page
Feature: A plugin page that draws itself
  A plugin may own a page that is not made of nodes: a component over its own
  address, mounted by navigation in the pane. It is an ordinary page of this
  app all the same — an address that opens it and survives a reload, links that
  go in place, to the right or into a new pane, a tab title from its
  breadcrumb, a palette row, and history.

  The page here is the `test-page` fixture's `/fixture/<word>`, registered in
  `app.route` with `defineSelfDrawnPage`, as any plugin would.

  Scenario: The address opens the page, its tab wears its breadcrumb, and a reload keeps it
    When I open the address "/fixture/alpha"
    Then pane 0 draws the fixture page for "alpha"
    And pane 0 is showing "/fixture/alpha"
    And tab 0 is titled "Fixture alpha"
    When I reload the page
    Then pane 0 draws the fixture page for "alpha"
    And the address is "/fixture/alpha"
    And tab 0 is titled "Fixture alpha"
    And there should be no page errors

  Scenario: A malformed word under the claimed prefix opens the front page, not a file
    When I open the address "/fixture/Not-A-Word"
    Then the focused pane is drawing the outline "Daily/2026-08.olai"
    And no fixture page is drawn
    And there should be no page errors

  Scenario Outline: A plain press on a link goes in place, and Back returns
    Given I open the address "/fixture/alpha"
    And I mark the page
    When in pane 0 I press the fixture link "Fixture beta" with "<gesture>"
    Then pane 0 draws the fixture page for "beta"
    And the address is "/fixture/beta"
    And there are 1 panes
    And tab 0 is titled "Fixture beta"
    When I go back
    Then pane 0 draws the fixture page for "alpha"
    And the address is "/fixture/alpha"
    And the page has not reloaded
    And there should be no page errors

    Examples:
      | gesture |
      | click   |
      | Enter   |

  Scenario: Alt opens to the right and reuses that pane; Alt-Shift inserts a new one
    Given I open the address "/fixture/alpha"
    And I mark the page
    When in pane 0 I press the fixture link "Fixture beta" with "Alt"
    Then there are 2 panes
    And pane 0 draws the fixture page for "alpha"
    And pane 1 draws the fixture page for "beta"
    And pane 1 is showing "/fixture/beta"
    When in pane 0 I press the fixture link "Fixture gamma" with "Alt"
    Then there are 2 panes
    And pane 1 draws the fixture page for "gamma"
    When in pane 0 I press the fixture link "Fixture beta" with "Alt-Shift"
    Then there are 3 panes
    And pane 0 draws the fixture page for "alpha"
    And pane 1 draws the fixture page for "beta"
    And pane 2 draws the fixture page for "gamma"
    When I reload the page
    Then there are 3 panes
    And pane 1 draws the fixture page for "beta"
    And pane 2 draws the fixture page for "gamma"
    And there should be no page errors

  Scenario: The fixture's palette row goes to its page
    Given I open the outline "house.olai"
    And I mark the page
    When I press the palette shortcut
    And I type "fixture alpha" into the palette
    And I press "Enter"
    Then pane 0 draws the fixture page for "alpha"
    And the address is "/fixture/alpha"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Switching the fixture off takes its page away, and on brings it back
    # With its tenant gone the address no longer names a plugin page: it is
    # read again by the app's own grammar (the front page, for a path with no
    # file suffix), exactly as the journal's pages are. The address bar keeps
    # the address, so the page comes back when the tenant does.
    Given I open the address "/fixture/alpha"
    And I mark the page
    Then pane 0 draws the fixture page for "alpha"
    When the settings file switches the row "test-page" off
    Then no fixture page is drawn
    And the focused pane is drawing the outline "Daily/2026-08.olai"
    And the address is "/fixture/alpha"
    When the settings file switches the row "test-page" on
    Then pane 0 draws the fixture page for "alpha"
    And the address is "/fixture/alpha"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The page draws its own filter box, and the filter rides in the address
    # Narrowing is a replace, as the outline's filter box is: the filter belongs
    # to the history entry it was typed on, and Back returns to that entry.
    Given I open the address "/fixture/alpha"
    When I type "red fox" into the fixture filter in pane 0
    Then pane 0's fixture page is narrowed by "red fox"
    And the fixture filter in pane 0 has the caret
    And the address is "/fixture/alpha?q=red+fox"
    When I reload the page
    Then pane 0's fixture page is narrowed by "red fox"
    And I mark the page
    When in pane 0 I press the fixture link "Fixture beta" with "click"
    Then pane 0 draws the fixture page for "beta"
    And pane 0's fixture page is narrowed by ""
    And the address is "/fixture/beta"
    When I go back
    Then pane 0 draws the fixture page for "alpha"
    And pane 0's fixture page is narrowed by "red fox"
    And the address is "/fixture/alpha?q=red+fox"
    When I clear the fixture filter in pane 0
    Then pane 0's fixture page is narrowed by ""
    And the address is "/fixture/alpha"
    And the page has not reloaded
    And there should be no page errors

  Scenario: An outline and a self-drawn page share a split, each drawn by its own host
    # Outlines draws pane 0 and navigation draws pane 1. Switching the fixture
    # off and on moves only pane 1; pane 0's page is the same element, and it
    # still edits.
    Given I open the address "/s/house.olai/fixture%2Falpha"
    Then there are 2 panes
    And pane 0 is drawing the outline "house.olai"
    And pane 1 draws the fixture page for "alpha"
    When I reload the page
    Then there are 2 panes
    And pane 0 is drawing the outline "house.olai"
    And pane 1 draws the fixture page for "alpha"
    When I mark the page
    And I tag the page drawn in pane 0
    And the settings file switches the row "test-page" off
    Then no fixture page is drawn
    And pane 1 is drawing the outline "Daily/2026-08.olai"
    And pane 0 is drawing the outline "house.olai"
    And the address is "/s/house.olai/fixture%2Falpha"
    When the settings file switches the row "test-page" on
    Then pane 1 draws the fixture page for "alpha"
    And pane 0 is drawing the outline "house.olai"
    And pane 0 still draws the page it was tagged on
    When I click the title of "handles"
    And I select all and type "choose the bronze handles"
    And I press "Enter"
    Then "house.olai" holds a node titled "choose the bronze handles"
    And pane 0 still draws the page it was tagged on
    And pane 1 draws the fixture page for "alpha"
    And the page has not reloaded
    And there should be no page errors
