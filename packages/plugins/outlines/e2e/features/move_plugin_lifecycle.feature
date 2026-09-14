@scratch:good
Feature: Preparing a move survives rebuilding the same page
  Scenario: A retained destination search moves the original row into another outline
    Given I open the outline "house.olai"
    And I mark the page
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "compost"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the move picker is open on "knobs"
    And the move picker search reads "compost"
    When I choose "the compost heap" from the move picker
    Then the node "knobs" in "garden.olai" sits under "compost"
    And the node "knobs" is not shown
    When I click the outline "garden.olai"
    Then the node "knobs" is a child of "compost"
    When I click the title of "knobs"
    And I select all and type "moved after rebuilding"
    And I press "Enter"
    And I press "Escape"
    Then "garden.olai" holds a node titled "moved after rebuilding"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Cancelling a retained move clears its search for the next row
    Given I open the outline "house.olai"
    And I mark the page
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "compost"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the move picker is open on "knobs"
    And the move picker search reads "compost"
    When I press "Escape"
    Then no move picker is open
    When I press "Escape"
    And I click the title of "handles"
    And I press "ControlOrMeta+Shift+m"
    Then the move picker is open on "handles"
    And the move picker search reads ""
    When I search the move picker for "order the new"
    And I choose "order the new cabinets" from the move picker
    Then the node "handles" is a child of "order"
    And the node "knobs" is a child of "install"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Navigating away discards a prepared move before returning
    Given I open the outline "house.olai"
    And I mark the page
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "compost"
    And I click the outline "garden.olai"
    Then no move picker is open
    When I click the outline "house.olai"
    Then no move picker is open
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    Then the move picker is open on "knobs"
    And the move picker search reads ""
    And the page has not reloaded
    And there should be no page errors
