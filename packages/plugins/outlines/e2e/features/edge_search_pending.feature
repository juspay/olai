@scratch:good @wire
Feature: A pending search never relabels retained edge targets
  Scenario: The previous query stays unspendable until the new answer arrives
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I open the node menu of "handles"
    And I choose "Link to a node…" from the node menu
    And I search the edge panel for "compost"
    And I mark the wire
    And I hold incoming updates to the original browser tab
    And I retype the edge panel's search as "mint" and press Enter at once
    Then the edge search has requested "mint" without relabelling its retained rows
    When I release incoming updates to the original browser tab
    And the edge panel's rows answer "mint"
    Then "house.olai" holds the node "handles" seeing nothing
    When I press "Enter"
    Then "house.olai" holds the node "handles" seeing "mint"
    And there should be no page errors
