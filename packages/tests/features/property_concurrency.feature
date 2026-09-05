@scratch:good
Feature: Property additions respect concurrent browser writes
  Scenario Outline: A newly added key cannot overwrite another tab's intervening addition
    Given I open the outline "house.olai"
    When I open another browser tab
    And I use the original browser tab
    And I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I draft the property <key> holding "submitted" on "handles"
    And I use the other browser tab
    And I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "audit" on "handles"
    Then "house.olai" holds the node "handles" with "stage" set to "audit"
    When I use the original browser tab
    Then the property editor on "handles" holds "submitted"
    When I press "Enter"
    Then the node "handles" refuses the property write with "it now says `audit`"
    And "house.olai" holds the node "handles" with "stage" set to "audit"
    When I edit the property "stage" on "handles"
    And I type "submitted" into the property editor on "handles"
    Then "house.olai" holds the node "handles" with "stage" set to "submitted"
    When I press "ControlOrMeta+z"
    Then "house.olai" holds the node "handles" with "stage" set to "audit"
    And there should be no page errors

    Examples:
      | key       |
      | "stage"   |
      | " stage " |

  Scenario: Concurrent additions of different keys preserve both values
    Given I open the outline "house.olai"
    When I open another browser tab
    And I use the original browser tab
    And I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I draft the property "stage" holding "submitted" on "handles"
    And I use the other browser tab
    And I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "owner" holding "Alex" on "handles"
    Then "house.olai" holds the node "handles" with "owner" set to "Alex"
    When I use the original browser tab
    And I press "Enter"
    Then "house.olai" holds the node "handles" with "stage" set to "submitted"
    And "house.olai" holds the node "handles" with "owner" set to "Alex"
    When I press "ControlOrMeta+z"
    Then "house.olai" holds the node "handles" with no "stage"
    And "house.olai" holds the node "handles" with "owner" set to "Alex"
    And there should be no page errors
