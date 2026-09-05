@scratch:good
Feature: A held pin drag never reorders a different pin
  Background:
    Given I open the outline "house.olai"
    And the directory has the pins:
      | /#order |
      | /#demo |
      | /agenda |
    Then the pinned shelf reads "/#order /#demo /agenda"

  Scenario: Removing the pin above the carried pin cancels the old drop
    When I hold the pin "/#demo" above "/#order"
    And I rewrite "Pins.olai" as:
      """
      {"id":"p1","ord":"a1","title":"/#demo"}
      {"id":"p2","ord":"a2","title":"/agenda"}
      """
    Then the pinned shelf reads "/#demo /agenda"
    And no pin drop line is shown
    When I let go
    Then the pinned shelf reads "/#demo /agenda"
    When I drag the pin "/agenda" above "/#demo"
    Then the pinned shelf reads "/agenda /#demo"
    When I press "ControlOrMeta+z"
    Then the pinned shelf reads "/#demo /agenda"
    And there should be no page errors

  Scenario: Escape cancels a held pin reorder and leaves a later reorder usable
    When I hold the pin "/agenda" above "/#order"
    And I press "Escape"
    Then no pin drop line is shown
    When I let go
    Then the pinned shelf reads "/#order /#demo /agenda"
    When I drag the pin "/agenda" above "/#order"
    Then the pinned shelf reads "/agenda /#order /#demo"
    When I press "ControlOrMeta+z"
    Then the pinned shelf reads "/#order /#demo /agenda"
    And there should be no page errors

  Scenario: External reordering cancels old geometry even when all pins remain
    When I hold the pin "/agenda" above "/#order"
    And I rewrite "Pins.olai" as:
      """
      {"id":"p1","ord":"a0","title":"/#demo"}
      {"id":"p0","ord":"a1","title":"/#order"}
      {"id":"p2","ord":"a2","title":"/agenda"}
      """
    Then the pinned shelf reads "/#demo /#order /agenda"
    And no pin drop line is shown
    When I let go
    Then the pinned shelf reads "/#demo /#order /agenda"
    When I drag the pin "/agenda" above "/#order"
    Then the pinned shelf reads "/#demo /agenda /#order"
    When I press "ControlOrMeta+z"
    Then the pinned shelf reads "/#demo /#order /agenda"
    And there should be no page errors
