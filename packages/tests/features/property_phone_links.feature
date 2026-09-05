@scratch:good @phone
Feature: Long property links remain readable and reachable on a phone
  Scenario: A long link fits its nested row while retaining the whole destination
    Given I open the outline "house.olai"
    When I hold a finger on the node "handles"
    And I choose "Add property…" from the node menu
    And I write the property "pr" holding "https://github.com/juspay/olai/pull/369#discussion_r1234567890" on "handles"
    Then the property "pr" on "handles" is a "away" door to "https://github.com/juspay/olai/pull/369#discussion_r1234567890"
    And the property "pr" on "handles" is not folded
    And the property "pr" on "handles" stays within the screen
    When I edit the property "pr" on "handles"
    Then the property editor on "handles" holds "https://github.com/juspay/olai/pull/369#discussion_r1234567890"
    And the property editor on "handles" fits the screen
    When I press "Escape"
    Then "house.olai" holds the node "handles" with "pr" set to "https://github.com/juspay/olai/pull/369#discussion_r1234567890"
    And there should be no page errors
