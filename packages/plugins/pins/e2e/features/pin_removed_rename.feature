@scratch:good
Feature: An unanswered pin rename notices that its pin has been removed
  Scenario: Unpinning in another tab prevents the old question from renaming Trash
    Given the directory has the pins:
      | /#order |
    And I open the outline "house.olai"
    When I rename the pin "/#order"
    And I type "abandoned shelf name" into the palette
    And I open another browser tab
    And I unpin "/#order"
    Then the pinned shelf is not drawn
    And "_olai/Trash.olai" holds a node titled "/#order"
    When I use the original browser tab
    And I click the palette box
    And I press "Enter"
    Then "_olai/Trash.olai" holds a node titled "/#order"
    And the palette says "no longer pinned"
    And there should be no page errors
