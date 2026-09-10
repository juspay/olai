@scratch:good
Feature: A parked draft owns its input while becoming active
  Pointer activation may overlap the previous draft's save. Focus belongs to
  the clicked slot during that wait, and subsequent input stays with that slot.

  Scenario: Activating a parked blank preserves its actual input element
    Given I open the outline "house.olai"
    When I click the title of "kitchen"
    And I put the caret at the start of the line
    And I press "Enter"
    And I press "Enter"
    And I remember the first parked input
    And I click the first new row
    Then the remembered parked input still holds the caret
    When I type "driveway"
    And I press "Enter"
    Then "house.olai" holds a node titled "driveway"
    And there should be no page errors

  Scenario: The clicked draft keeps text typed across the preceding save's reply
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I click the title of "kitchen"
    And I put the caret at the start of the line
    And I press "Enter"
    And I press "Enter"
    And I type "garage"
    And I hold incoming updates to the original browser tab
    And I click the first new row
    And I type "driveway"
    Then "house.olai" holds a node titled "garage"
    When I release incoming updates to the original browser tab
    And I type " entrance"
    And I press "Enter"
    Then the node titled "driveway entrance" comes before the node titled "garage"
    And the node titled "garage" comes before "kitchen"
    And there should be no page errors
