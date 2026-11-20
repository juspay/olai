@scratch:good
Feature: Undo after a pin drop takes back that drop, even before its write has answered
  Scenario: Undo pressed before the drop's reply still takes the drop back
    Given pin write replies can be held
    And I open the outline "house.olai"
    And the directory has the pins:
      | /zoom/#order |
      | /agenda |
    Then the pinned shelf reads "/zoom/#order /agenda"
    When I hold the next pin write reply
    And I drag the pin "/agenda" above "/zoom/#order"
    Then the pinned shelf reads "/agenda /zoom/#order"
    When I press "ControlOrMeta+z" without waiting
    And I release the held pin write reply
    Then the pinned shelf reads "/zoom/#order /agenda"
    And there should be no page errors
