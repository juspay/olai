@scratch:good
Feature: A held pin drag never reorders a different pin
  Background:
    Given I open the outline "house.olai"
    And the directory has the pins:
      | /zoom/#order |
      | /zoom/#demo |
      | /agenda |
    Then the pinned shelf reads "/zoom/#order /zoom/#demo /agenda"

  Scenario: The secondary mouse button cannot reorder pins
    When I drag the pin "/agenda" above "/zoom/#order" with the secondary mouse button
    Then the pinned shelf reads "/zoom/#order /zoom/#demo /agenda"
    When I press "Escape"
    And I drag the pin "/agenda" above "/zoom/#order"
    Then the pinned shelf reads "/agenda /zoom/#order /zoom/#demo"
    When I press "ControlOrMeta+z"
    Then the pinned shelf reads "/zoom/#order /zoom/#demo /agenda"
    And there should be no page errors

  Scenario: Removing the pin above the carried pin cancels the old drop
    When I hold the pin "/zoom/#demo" above "/zoom/#order"
    And I rewrite "_olai/Pins.olai" as:
      """
      {"id":"p1","ord":"a1","title":"/zoom/#demo"}
      {"id":"p2","ord":"a2","title":"/agenda"}
      """
    Then the pinned shelf reads "/zoom/#demo /agenda"
    And no pin drop line is shown
    When I let go
    Then the pinned shelf reads "/zoom/#demo /agenda"
    When I drag the pin "/agenda" above "/zoom/#demo"
    Then the pinned shelf reads "/agenda /zoom/#demo"
    When I press "ControlOrMeta+z"
    Then the pinned shelf reads "/zoom/#demo /agenda"
    And there should be no page errors

  Scenario: Escape cancels a held pin reorder and leaves a later reorder usable
    When I hold the pin "/agenda" above "/zoom/#order"
    And I press "Escape"
    Then no pin drop line is shown
    When I let go
    Then the pinned shelf reads "/zoom/#order /zoom/#demo /agenda"
    When I drag the pin "/agenda" above "/zoom/#order"
    Then the pinned shelf reads "/agenda /zoom/#order /zoom/#demo"
    When I press "ControlOrMeta+z"
    Then the pinned shelf reads "/zoom/#order /zoom/#demo /agenda"
    And there should be no page errors

  Scenario: Removing the carried pin cancels its drop and restoration permits a new reorder
    When I remember the served bytes of "_olai/Pins.olai"
    And I hold the pin "/zoom/#demo" above "/zoom/#order"
    And I rewrite "_olai/Pins.olai" as:
      """
      {"id":"p0","ord":"a0","title":"/zoom/#order"}
      {"id":"p2","ord":"a2","title":"/agenda"}
      """
    Then the pinned shelf reads "/zoom/#order /agenda"
    And no pin drop line is shown
    When I let go
    Then the pinned shelf reads "/zoom/#order /agenda"
    When I restore the remembered served bytes of "_olai/Pins.olai"
    Then the pinned shelf reads "/zoom/#order /zoom/#demo /agenda"
    When I drag the pin "/zoom/#demo" above "/zoom/#order"
    Then the pinned shelf reads "/zoom/#demo /zoom/#order /agenda"
    When I press "ControlOrMeta+z"
    Then the pinned shelf reads "/zoom/#order /zoom/#demo /agenda"
    And there should be no page errors

  Scenario: External reordering cancels old geometry even when all pins remain
    When I hold the pin "/agenda" above "/zoom/#order"
    And I rewrite "_olai/Pins.olai" as:
      """
      {"id":"p1","ord":"a0","title":"/zoom/#demo"}
      {"id":"p0","ord":"a1","title":"/zoom/#order"}
      {"id":"p2","ord":"a2","title":"/agenda"}
      """
    Then the pinned shelf reads "/zoom/#demo /zoom/#order /agenda"
    And no pin drop line is shown
    When I let go
    Then the pinned shelf reads "/zoom/#demo /zoom/#order /agenda"
    When I drag the pin "/agenda" above "/zoom/#order"
    Then the pinned shelf reads "/zoom/#demo /agenda /zoom/#order"
    When I press "ControlOrMeta+z"
    Then the pinned shelf reads "/zoom/#demo /zoom/#order /agenda"
    And there should be no page errors
