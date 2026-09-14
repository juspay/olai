@scratch:good
Feature: Unfinished outline rows survive an unrelated plugin change
  Scenario: Navigating another phone tab preserves the inactive outline skeleton
    Given I open the address "/s/house.olai/house.olai"
    When I shrink the window to a phone
    And I click the title of "handles"
    And I press "Enter"
    Then a new row is being typed
    When I tap pane tab 1
    And I click the outline "garden.olai"
    And I tap pane tab 0
    Then a new row is being typed
    When I click the first new row
    And I type "surviving row"
    And I press "Enter"
    Then "house.olai" holds a node titled "surviving row"
    And there should be no page errors

  Scenario: Phone tabs of the same outline keep their own parked skeletons
    Given I open the address "/s/house.olai/house.olai"
    When I shrink the window to a phone
    And I click the title of "handles"
    And I press "Enter"
    Then a new row is being typed
    When I tap pane tab 1
    Then 0 new rows are being typed
    When I click the title of "knobs"
    And I press "Enter"
    And I press "Enter"
    Then 2 new rows are being typed
    When I tap pane tab 0
    Then a new row is being typed
    When I tap pane tab 1
    Then 2 new rows are being typed
    And there should be no page errors

  Scenario: A parked outline skeleton survives a rebuild and can still be filled in
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I press "Enter"
    And I press "Enter"
    Then 2 new rows are being typed
    When I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    Then 2 new rows are being typed
    When I click the first new row
    And I type "measure twice"
    And I press "Enter"
    Then "house.olai" holds a node titled "measure twice"
    And the node titled "measure twice" comes before "hinges"
    And there should be no page errors

  Scenario: A refused title survives a plugin rebuild and can be corrected
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I select all and type ""
    And I press "Enter"
    Then the refusal says "a node needs a title"
    When I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    Then the row being typed holds ""
    And the refusal says "a node needs a title"
    When I return to the row being typed
    And I type "recovered handles"
    And I press "Enter"
    Then the node "handles" has the title "recovered handles"
    And there should be no page errors

  Scenario: Discarding a restored blank prevents a later rebuild from reviving it
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I press "Enter"
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    Then a new row is being typed
    When I click the first new row
    And I press "Escape"
    And I open the plugins panel
    And I switch the plugin "journal" on
    And I close the plugins panel
    Then 0 new rows are being typed
    And there should be no page errors

  Scenario: Explicit navigation discards the old page's parked rows
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I press "Enter"
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    Then a new row is being typed
    When I click the outline "garden.olai"
    And I click the outline "house.olai"
    Then 0 new rows are being typed
    And there should be no page errors
