Feature: one node, zoomed

  Every node has a page of its own at the key the load layer minted for it —
  a permalink you can paste at someone. It draws that subtree and the trail
  above it, and it is as live as the home page: the same file, the same SSE
  swap, its own address.

  Scenario: a bullet is a link to the node's own page
    When I open the home page
    And I zoom into "Inbox"
    Then I am on a node's own page
    And the main pane is zoomed
    And the tab is named for "Inbox"
    And I see the title "Buy milk"
    And I do not see the title "Ship the server"

  Scenario: the breadcrumbs are the trail above the node
    When I open the home page
    And I zoom into "Buy milk"
    Then the breadcrumbs read "home > Tasks.rkt > Inbox #capture"
    When I follow the breadcrumb "Inbox #capture"
    Then the main pane is zoomed
    And the tab is named for "Inbox"
    And I see the title "Buy milk"
    When I follow the breadcrumb "home"
    Then I am back on the home page
    And I see the title "Ship the server"

  Scenario: the sidebar tree zooms to the same page
    When I open the home page
    And I zoom into the sidebar's "Ship the server"
    Then I am on a node's own page
    And the tab is named for "Ship the server"
    And I see the title "Write the tests"

  # The parent is named as the FILE spells it: a tag and an anchor are part of
  # the line, and this step edits the file rather than the page.
  Scenario: a zoomed page follows the file like any other
    When I open the home page
    And I zoom into "Inbox"
    And I mark this page load
    And I add the title "Call the dentist" under "Inbox #capture" in the outline
    Then I see the title "Call the dentist"
    And the page has not reloaded
    And the main pane is zoomed

  # A node can be deleted, or an unanchored one re-keyed, while a tab sits
  # zoomed on it — and that tab re-fetches this very page to find out. So it is
  # a page saying the node is gone, not a 404 that would leave the tab showing
  # a node that no longer exists.
  Scenario: a node that has gone away says so, on the page
    When I open the home page
    And I zoom into "Write the tests"
    And I mark this page load
    And I remove the title "Write the tests" from the outline
    Then the page says there is no such node
    And the page has not reloaded
