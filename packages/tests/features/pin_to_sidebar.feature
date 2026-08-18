@scratch:good
Feature: Pinning a page to the sidebar
  A shelf of doors at the top of the directory column: any node, any document,
  and the page a reader has narrowed with a query, one click away.

  The whole of it is STORED IN THE DIRECTORY and nothing about it is
  browser-local — `Pins.olai`, one ordinary node per pin, whose title is the
  ADDRESS the pin opens. That is what makes the shelf something an agent can
  read and write with the tools it already has (`add_node`, `move_node`,
  `archive_node`), and it is why these scenarios assert on the FILE as often as
  on the column.

  Two promises a screenshot cannot make are here as scenarios: a click lands on
  the page WITH its query, and a node renamed anywhere else says its new name
  on the shelf — because the shelf keeps no copy of it to go stale.

  `@scratch:` because these write the directory they are served.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: An empty shelf draws nothing at all
    # Not an empty box and not a hint: a directory with no pins is the ordinary
    # state of every directory olai has ever served.
    Then the pinned shelf is not drawn

  Scenario: A node pinned from the row menu appears on the shelf, and in the file
    When I open the node menu of "order"
    And I choose "Pin to sidebar" from the node menu
    Then the pinned shelf holds "/n/order"
    And "Pins.olai" holds a node titled "/n/order"
    And the pin "/n/order" is named "order the new cabinets"
    And there should be no page errors

  Scenario: The shelf says the node's name RIGHT NOW, not the one it was pinned under
    When I open the node menu of "order"
    And I choose "Pin to sidebar" from the node menu
    And the file "house.olai" renames "order" to "order the walnut ones"
    Then the pin "/n/order" is named "order the walnut ones"

  Scenario: A pinned node is offered the way off the shelf instead
    When I open the node menu of "order"
    And I choose "Pin to sidebar" from the node menu
    And I open the node menu of "order"
    Then the node menu offers "Unpin from sidebar"
    And the node menu does not offer "Pin to sidebar"

  Scenario: The page a reader has narrowed is pinned WITH its query, and opens with it
    When I filter the page by "is:todo"
    And I pin the page
    Then the pinned shelf holds "/o/house.olai?q=is%3Atodo"
    When I open the outline "garden.olai"
    And I follow the pin "/o/house.olai?q=is%3Atodo"
    # The WHOLE bar, not the path: a door that dropped the query would pass a
    # step that only read the path, and would open a different page.
    Then the address is exactly "/o/house.olai?q=is%3Atodo"
    And the filter box holds "is:todo"

  Scenario: A document is a door like any other
    When I open the document "finishes.md"
    And I pin the page
    Then the pinned shelf holds "/doc/finishes.md"
    And the pin "/doc/finishes.md" is named "finishes.md"

  Scenario: The chord is a toggle over one address
    When I pin the page
    Then the pinned shelf holds "/o/house.olai"
    When I pin the page
    Then the pinned shelf is not drawn
    # Unpinning is the set's own removal, so it is reversible rather than gone.
    And "Archive.olai" holds a node titled "/o/house.olai"

  Scenario: A pin is taken off the shelf from the shelf
    When I pin the page
    And I unpin "/o/house.olai"
    Then the pinned shelf is not drawn

  Scenario: Pins are ordered by the file, and a drag reorders them
    Given the directory has the pins:
      | /n/order  |
      | /n/demo   |
      | /agenda   |
    Then the pinned shelf reads "/n/order /n/demo /agenda"
    When I drag the pin "/agenda" above "/n/order"
    Then the pinned shelf reads "/agenda /n/order /n/demo"
    And there should be no page errors

  Scenario: A row of the shelf's outline that is not an address is not a door
    # `Pins.olai` is an ordinary outline: a heading or a note in it is a thing
    # somebody may write, and a title that merely begins with a slash is text.
    Given the directory has the pins:
      | /n/order          |
      | the ones I keep   |
      | /etc/passwd       |
    Then the pinned shelf reads "/n/order"

  Scenario: A pin an agent wrote arrives without a reload
    When the directory grows a pin to "/agenda"
    Then the pinned shelf holds "/agenda"
    And the page has not reloaded
