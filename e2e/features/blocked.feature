Feature: what is not actionable yet, on the page

  `@after ^serve` is ordering, not scheduling: the node stays where it is in
  the tree and says it is waiting. The pill names what it waits on, links to
  it, and goes away when that node is checked off — which the page finds out
  the way it finds out about any other write.

  Scenario: a node waiting on an unfinished one draws its own pill
    When I open the home page
    Then "Announce the release" is blocked on "^serve"
    And "Ship the server" is not blocked

  Scenario: an ordinary node is waiting on nothing
    When I open the home page
    Then "Buy milk" is not blocked
    And "Draft the migration plan" is not blocked

  Scenario: checking the blocker off from the CLI clears it, live
    When I open the home page
    Then "Announce the release" is blocked on "^serve"
    And I mark this page load
    When I check off "Ship the server" from the CLI
    Then "Announce the release" stops being blocked
    And the page has not reloaded
