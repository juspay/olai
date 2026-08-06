Feature: a node that expands into a document

  `@doc` attaches a file to a node. In the outline the node shows one line of
  it and the file's name; on the node's own page the document is drawn in
  full. The file is watched like the outline is, so editing it redraws every
  open page without anyone touching the .rkt.

  Scenario: the outline shows one line of the document
    When I open the home page
    Then "Ship the server" attaches the document "serve.md"
    And the document line under "Ship the server" reads "Shipping the server"
    And no document is drawn in full

  Scenario: the document is the node's own page
    When I open the home page
    And I follow the document under "Ship the server"
    Then I am on a node's own page
    And the tab is named for "Ship the server"
    And the document on this page reads "Fixture fiction"
    And the document on this page reads "What is in here"

  # A node with no @doc has no document line at all — the block is drawn for
  # the field, not for every node.
  Scenario: an undocumented node draws nothing
    When I open the home page
    Then "Buy milk" attaches no document

  # The outline did not move. The document did, and the page it is drawn on
  # has to find out the same way it finds out about a save to the outline.
  Scenario: editing the document redraws an open page
    When I open the home page
    And I zoom into "Ship the server"
    And I mark this page load
    And I rewrite the document
    Then the document on this page reads "Rewritten under the server"
    And the page has not reloaded
