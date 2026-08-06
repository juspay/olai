Feature: one node, shown wherever it matters

  A `^anchor` names a node across the whole set of outlines the server was
  pointed at, not just inside the file that wrote it. So a second file can
  put `*serve` in its own list and get the node Tasks.rkt defines — the same
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

  @cross-file
  Scenario: checking it off from the mirroring file flips the one real node
    When I open the home page
    Then "Ship the server" is not done
    When I check off "^serve" from the CLI against "Week.rkt"
    Then "Ship the server" becomes done
