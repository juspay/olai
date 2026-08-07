Feature: one node, shown wherever it matters

  A `^anchor` names a node across the whole set of outlines the server was
  pointed at, not just inside the file that wrote it. So a second file can
  put `*serve` in its own list and get the node Tasks.jsonl defines — the same
  node, not a copy: it follows an edit to the file that defines it, and
  checking it off from either side flips the one that is real.

  @cross-file
  Scenario: a node defined in one file is drawn in another
    When I open the home page
    Then "Next week" holds a mirror of "serve"
    And the mirror under "Next week" draws "Ship the server"
    And the sidebar lists "Next week"

  @cross-file
  Scenario: the mirror follows an edit to the file that defines the node
    When I open the home page
    And I mark this page load
    And I rename the title "Ship the server" to "Ship the server first" in the outline
    Then the mirror under "Next week" draws "Ship the server first"
    And the page has not reloaded

  # The mirrored node stores no state of its own — it is done when its
  # children are (docs/syntax.md#derived-state) — so the write lands on the
  # CHILD, from the file that only mirrors the parent. An anchor's scope is
  # the set: the write routes into the file that declares it, and the mirror
  # site draws the answer the tree now gives.
  @cross-file
  Scenario: checking it off from the mirroring file flips the one real node
    When I open the home page
    Then "Ship the server" is not done
    When I check off "^tests" from the CLI against "Week.jsonl"
    Then "Ship the server" becomes done

  # THE ARROW. It is a link to the node this site mirrors, and the node is
  # somewhere else — another file, and usually another page. It used to be the
  # same-page fragment `#serve`, which is in the markup only where the defining
  # site is: on a zoom page there is no defining site, so the click did nothing
  # at all. Nothing here clicked it, which is how that shipped.
  @cross-file
  Scenario: the arrow on a mirror reaches the file that defines the node
    When I open the home page
    And I zoom into "Next week"
    And I follow the mirror's arrow under "Next week"
    Then I am on a node's own page
    And the tab is named for "Ship the server"
    And the breadcrumbs read "home > Tasks.jsonl"
    And I see the title "Write the tests"

  # The same arrow on the one page the fragment did work — where it scrolled
  # instead of navigating. One arrow, one behaviour: it goes to the node's page.
  Scenario: the arrow on an in-file mirror goes to the node's own page
    When I open the home page
    And I follow the mirror's arrow under "This week"
    Then I am on a node's own page
    And the tab is named for "Ship the server"
    And the breadcrumbs read "home > Tasks.jsonl"
    And I see the title "Write the tests"
