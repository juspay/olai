Feature: finding a node from the keyboard

  A palette over whatever you are reading: `/` opens it, typing narrows it,
  ↑/↓ walk the hits and Enter lands on one. None of that is visible to the
  racket tests — the box does its own fetching, the keys are the browser's,
  and what a query names is only markup once a swap has landed.

  Scenario: slash opens the box, typing finds a node, Enter lands on it
    When I open the home page
    And I press slash
    Then the search box has the focus
    When I search for "milk"
    Then the search results name "Buy milk"
    When I press Enter in the search box
    Then I am on a node's own page
    And the tab is named for "Buy milk"
    And the search palette is closed

  # Enter from the box means the first hit; the arrow keys are how you mean
  # another one. The focused hit IS the picked one — there is no second
  # highlight for a browser and a script to disagree about.
  Scenario: the arrow keys walk the hits
    When I open the home page
    And I search for "ship"
    Then the search results name "Ship the server"
    And the search results name "Ship the pitch"
    When I press the down arrow
    And I press the down arrow
    Then the second hit has the focus
    When I press Enter on the focused hit
    Then I am on a node's own page
    And the tab is named for "Ship the pitch"

  # A note is a field like any other, and a hit found by one says so: the
  # line under the title is what the query landed in.
  Scenario: a node is found by its note
    When I open the home page
    And I search for "grammar"
    Then the search results name "Draft the migration plan"
    And the hit shows the note it was found by

  Scenario: a query with nothing behind it says so
    When I open the home page
    And I search for "zzzznothing"
    Then the search says nothing matches

  Scenario: escape puts the palette away
    When I open the home page
    And I search for "milk"
    Then the search results name "Buy milk"
    When I press escape
    Then the search palette is closed
    And I see the title "Ship the server"

  # The results are a live region on the same stream as the outline: a file
  # that moves while a palette is open lands IN it, rather than leaving it
  # naming an outline that has changed underneath.
  Scenario: an open palette follows the file
    When I open the home page
    And I search for "milk"
    Then the search results name "Buy milk"
    When I mark this page load
    And I add the title "Buy oat milk" under "Inbox #capture" in the outline
    Then the search results name "Buy oat milk"
    And the page has not reloaded

  # /search?q=… is a page, which is what makes a query something you can
  # paste at someone — and what a browser running no JS submits the box to.
  Scenario: a query is a permalink
    When I open the search page for "milk"
    Then the search palette is open
    And the search results name "Buy milk"
