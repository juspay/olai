@scratch:good
Feature: Prepared links survive rebuilding the same node
  Scenario: A row link search survives rebuilding and writes to the original row
    Given I open the outline "house.olai"
    And I mark the page
    When I open the node menu of "handles"
    And I choose "Link to a node…" from the node menu
    And I search the edge panel for "compost"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the see panel is open on "handles"
    And the edge panel search reads "compost"
    When I choose "the compost heap" from the edge panel
    Then "house.olai" holds the node "handles" seeing "compost"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then "house.olai" holds the node "handles" seeing nothing
    And the page has not reloaded
    And there should be no page errors

  Scenario: A zoomed prerequisite search survives rebuilding and remains removable
    Given I open the node "handles"
    And I mark the page
    When I open the after panel from the page
    And I search the edge panel for "compost"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the after panel is open on "handles"
    And the edge panel search reads "compost"
    When I choose "the compost heap" from the edge panel
    Then "house.olai" holds the node "handles" after "compost"
    When I press "Escape"
    And I drop "compost" from the drawn "after" of "handles"
    Then "house.olai" holds the node "handles" after nothing
    And the page has not reloaded
    And there should be no page errors

  Scenario: Cancelling a retained panel clears the next relation and navigation clears the panel
    Given I open the node "handles"
    And I mark the page
    When I open the after panel from the page
    And I search the edge panel for "compost"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the after panel is open on "handles"
    And the edge panel search reads "compost"
    When I press "Escape"
    And I open the see panel from the page
    Then the see panel is open on "handles"
    And the edge panel search reads ""
    When I search the edge panel for "mint"
    And I click the outline "garden.olai"
    And I go back
    Then the zoomed node is "handles"
    And no edge panel is open
    When I open the after panel from the page
    Then the after panel is open on "handles"
    And the edge panel search reads ""
    And "house.olai" holds the node "handles" after nothing
    And "house.olai" holds the node "handles" seeing nothing
    And the page has not reloaded
    And there should be no page errors
