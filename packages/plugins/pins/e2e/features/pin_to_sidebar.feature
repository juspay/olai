@share-scratch
@scratch:good
Feature: Pinning a page to the sidebar
  A shelf of doors at the top of the directory column: any node, any document,
  and the page a reader has narrowed with a query, one click away.

  The whole of it is STORED IN THE DIRECTORY and nothing about it is
  browser-local — `Pins.olai`, one ordinary node per pin, whose title is the
  ADDRESS the pin opens. That is what makes the shelf something an agent can
  read and write with the tools it already has (`outlines_add`, `outlines_move`,
  `outlines_trash`), and it is why these scenarios assert on the FILE as often as
  on the column.

  Two promises a screenshot cannot make are here as scenarios: a click lands on
  the page WITH its query, and a node renamed anywhere else says its new name
  on the shelf — because the shelf keeps no copy of it to go stale.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: A node pinned from the row menu appears on the shelf, and in the file
    When I open the node menu of "order"
    And I choose "Pin to sidebar" from the node menu
    Then the pinned shelf holds "/zoom/#order"
    And "_olai/Pins.olai" holds a node titled "/zoom/#order"
    And the pin "/zoom/#order" is named "order the new cabinets"
    And there should be no page errors

  Scenario: The shelf says the node's name RIGHT NOW, not the one it was pinned under
    When I open the node menu of "order"
    And I choose "Pin to sidebar" from the node menu
    And the file "house.olai" renames "order" to "order the walnut ones"
    Then the pin "/zoom/#order" is named "order the walnut ones"

  Scenario: A pinned node is offered the way off the shelf instead
    When I open the node menu of "order"
    And I choose "Pin to sidebar" from the node menu
    Then the pinned shelf holds "/zoom/#order"
    When I open the node menu of "order"
    Then the node menu offers "Unpin from sidebar"
    And the node menu does not offer "Pin to sidebar"

  Scenario: The page a reader has narrowed is pinned WITH its query, and opens with it
    When I filter the page by "is:todo"
    And I pin the page
    Then the palette asks "Name this pin, or leave it blank"
    When I name the pin ""
    Then the pinned shelf holds "/house.olai?q=is%3Atodo"
    And "_olai/Pins.olai" holds a node titled "/house.olai?q=is%3Atodo"
    When I open the outline "garden.olai"
    And I mark the screen
    And I follow the pin "/house.olai?q=is%3Atodo"
    Then the address is exactly "/house.olai?q=is%3Atodo"
    And the filter box holds "is:todo"
    And the node "demo" was never drawn
    And the pane was never empty

  Scenario: A saved search is NAMED where the thought arrives, and comes back named
    When I filter the page by "is:todo"
    And I pin the page
    And I name the pin "What is late"
    Then the pin "/house.olai?q=is%3Atodo" is named "What is late"
    And the pin "/house.olai?q=is%3Atodo" carries the query "is:todo"
    And "_olai/Pins.olai" holds a node titled "[What is late](/house.olai?q=is%3Atodo)"
    When I open the outline "garden.olai"
    And I follow the pin "/house.olai?q=is%3Atodo"
    Then the address is exactly "/house.olai?q=is%3Atodo"
    And the filter box holds "is:todo"
    And there should be no page errors

  Scenario: Escape backs out of the name, and out of the pin with it
    When I filter the page by "is:todo"
    And I pin the page
    Then the palette asks "Name this pin, or leave it blank"
    When I press "Escape"
    Then the pinned shelf is not drawn
    And "_olai/Pins.olai" holds nothing
    When I pin the page
    And I name the pin ""
    Then the pinned shelf holds "/house.olai?q=is%3Atodo"
    And there should be no page errors

  Scenario: A pin is renamed from the shelf, and ⌘Z takes the name back
    Given the directory has the pins:
      | /zoom/#order |
    When I rename the pin "/zoom/#order"
    Then the palette asks "Rename this pin, or leave it blank"
    When I name the pin "Kitchen project"
    Then the pin "/zoom/#order" is named "Kitchen project"
    And "_olai/Pins.olai" holds a node titled "[Kitchen project](/zoom/#order)"
    When I press "ControlOrMeta+z"
    Then the pin "/zoom/#order" is named "order the new cabinets"
    And there should be no page errors

  Scenario: A document is a door like any other
    When I open the document "finishes.md"
    And I pin the page
    Then the pinned shelf holds "/finishes.md"
    And the pin "/finishes.md" is named "finishes.md"

  Scenario: The palette row is a toggle over one address, and mints the shelf under _olai/
    When I pin the page
    Then the pinned shelf holds "/house.olai"
    And "_olai/Pins.olai" holds a node titled "/house.olai"
    When I pin the page
    Then the pinned shelf is not drawn
    And "_olai/Trash.olai" holds a node titled "/house.olai"

  Scenario: A pin is taken off the shelf from the shelf
    When I pin the page
    And I unpin "/house.olai"
    Then the pinned shelf is not drawn
    When I press "ControlOrMeta+z"
    Then the pinned shelf holds "/house.olai"
    When I press "ControlOrMeta+Shift+z"
    Then the pinned shelf is not drawn
    And there should be no page errors

  Scenario: Pins are ordered by the file, and a drag reorders them
    Given the directory has the pins:
      | /zoom/#order  |
      | /zoom/#demo   |
      | /agenda   |
    Then the pinned shelf reads "/zoom/#order /zoom/#demo /agenda"
    When I drag the pin "/agenda" above "/zoom/#order"
    Then the pinned shelf reads "/agenda /zoom/#order /zoom/#demo"
    When I press "ControlOrMeta+z"
    Then the pinned shelf reads "/zoom/#order /zoom/#demo /agenda"
    When I press "ControlOrMeta+Shift+z"
    Then the pinned shelf reads "/agenda /zoom/#order /zoom/#demo"
    And there should be no page errors

  Scenario: Pins.olai opened as an outline reads like an outline
    Given the directory has the pins:
      | /finishes.md |
      | /zoom/#order         |
    When I open "_olai/Pins.olai" from the vault group
    Then the node "p0" reads "finishes.md"
    And the node "p1" reads "order the new cabinets"
    When I click the title of "p1"
    Then the editor holds "/zoom/#order"
    And there should be no page errors

  Scenario: A pin written as a link draws its NAME, and pressing it opens the address
    Given the directory has the pins:
      | [Kitchen project](/zoom/#order)          |
      | [What is late](/agenda?q=is%3Atodo)  |
    Then the pin "/zoom/#order" is named "Kitchen project"
    And the pin "/agenda?q=is%3Atodo" is named "What is late"
    And the pin "/agenda?q=is%3Atodo" carries the query "is:todo"
    When I open "_olai/Pins.olai" from the vault group
    And I mark the page
    Then the node "p0" reads "Kitchen project"
    And the node "p1" reads "What is late is:todo"
    When I press the name of "p0"
    Then the address is "/zoom/#order"
    And the page has not reloaded

  Scenario: A label is the words somebody chose, not markup
    Given the directory has the pins:
      | [Kitchen #home](/zoom/#order) |
    Then the pin "/zoom/#order" is named "Kitchen #home"
    When I open "_olai/Pins.olai" from the vault group
    Then the node "p0" reads "Kitchen #home"
    And the node "p0" draws no tag

  Scenario: A reorder lands where the pointer is, though the page moved under it
    Given the directory has the pins:
      | /zoom/#order  |
      | /zoom/#demo   |
      | /agenda   |
    When I open the document "kitchen-sink.md"
    And I drag the pin "/agenda" above "/zoom/#order" while the page scrolls
    Then the pinned shelf reads "/agenda /zoom/#order /zoom/#demo"
    And there should be no page errors

  Scenario: A title spelled with an escape nothing can read takes nothing down
    Given the directory has the pins:
      | /zoom/#%     |
      | /zoom/#order |
    Then the pinned shelf reads "/zoom/#order"
    And the outline list links to "house.olai"
    And there should be no page errors

  Scenario: A pin an agent wrote arrives without a reload
    When the directory grows a pin to "/agenda"
    Then the pinned shelf holds "/agenda"
    And the page has not reloaded

  @phone
  Scenario: A thumb takes a pin off the shelf
    Given the directory has the pins:
      | /zoom/#order |
    Then the pinned shelf holds "/zoom/#order"
    And the pin "/zoom/#order" shows its controls without a hover
    When I tap the unpin of "/zoom/#order"
    Then the pinned shelf is not drawn
    And there should be no page errors
