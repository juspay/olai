Feature: done work leaves the file without dying

  `olai archive` moves a node's subtree out of the working outline and into
  Archive.rkt, re-creating the chain it hung off so the tree still reads years
  later. The page it left redraws without it — live, like any other edit — and
  a page of its own draws what is in there. The node did not die: its anchor
  moved with it, so a mirror in a file that is still live goes on drawing it.

  @archived
  Scenario: an archived node leaves the outline and turns up in the archive
    When I open the home page
    And I mark this page load
    And I archive "Write the tests" from the CLI
    Then "Write the tests" leaves the page
    And the page has not reloaded
    When I follow the sidebar's Archive link
    Then I see the title "Write the tests"
    And I see the title "Ship the server"
    And I see the title "moved the boxes"

  @archived
  Scenario: the archive is somewhere you go, not something in the way
    When I open the home page
    Then the sidebar links to "/archive"
    And I do not see the title "moved the boxes"
    And the sidebar does not list "moved the boxes"

  @archived
  Scenario: a mirror of an archived node still draws it
    When I open the home page
    Then "This week" holds a mirror of "serve"
    When I mark this page load
    And I archive "^serve" from the CLI
    Then the mirror under "This week" draws "Ship the server"
    And the page has not reloaded
    When I follow the sidebar's Archive link
    Then I see the title "Ship the server"
