@scratch:good
Feature: Sidebar pins remain useful when their files disappear and return
  Scenario: A document pin survives a missing target and opens its restored content
    Given I rewrite "notes/pinned.md" as:
      """
      **before removal**
      """
    And I open the document "notes/pinned.md"
    And I mark the page
    When I pin the page
    Then the pinned shelf holds "/notes/pinned.md"
    When I click the outline "house.olai"
    And I remove the served file "notes/pinned.md"
    Then the pinned shelf holds "/notes/pinned.md"
    When I follow the pin "/notes/pinned.md"
    Then the main pane says there is no document "notes/pinned.md"
    When I rewrite "notes/pinned.md" as:
      """
      **restored pinned document**
      """
    Then the document renders bold text "restored pinned document"
    When I click the outline "house.olai"
    And I follow the pin "/notes/pinned.md"
    Then the document renders bold text "restored pinned document"
    When I start editing the document
    And I retype the document as:
      """
      **edited through the restored pin**
      """
    And I save the document
    Then the document renders bold text "edited through the restored pin"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Restoring the pins file replaces the vanished shelf with its new destinations
    Given the directory has the pins:
      | /#order |
    And I open the outline "house.olai"
    And I mark the page
    Then the pinned shelf holds "/#order"
    When I remove the served file "Pins.olai"
    Then the pinned shelf is not drawn
    When I rewrite "Pins.olai" as:
      """
      {"id":"restored-pin","ord":"a0","title":"[Restored garden](/garden.olai)"}
      """
    Then the pinned shelf holds "/garden.olai"
    And the pin "/garden.olai" is named "Restored garden"
    When I follow the pin "/garden.olai"
    Then the address is "/garden.olai"
    When I unpin "/garden.olai"
    Then the pinned shelf is not drawn
    And "_olai/Trash.olai" holds a node titled "[Restored garden](/garden.olai)"
    And the page has not reloaded
    And there should be no page errors
