Feature: Browser history survives changes to the plugins serving its pages
  @scratch:journal
  Scenario: Back reaches an unavailable journal route and Forward survives its restoration
    Given I open the day "2019-11-05"
    And I mark the page
    When I click the outline "work.olai"
    Then the address is "/work.olai"
    When I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    Then the journal chrome is absent
    When I go back
    Then no journal page is drawn
    And the address is "/d/2019-11-05"
    When I open the plugins panel
    And I switch the plugin "journal" on
    And I close the plugins panel
    Then the day open is "2019-11-05"
    And the node "ferry" is shown
    When I go forward
    Then the address is "/work.olai"
    And the node "sweep" is shown
    When I click the title of "sweep"
    And I select all and type "sweep after restoring history"
    And I press "Enter"
    Then "work.olai" holds a node titled "sweep after restoring history"
    When I go back
    Then the day open is "2019-11-05"
    When I click the day "2019-11-06"
    Then the day open is "2019-11-06"
    And the node "pack" is shown
    And the page has not reloaded
    And there should be no page errors

  @scratch:good
  Scenario: Back and Forward restore a closed split after the browser runtime rebuilds
    Given I open the outline "house.olai"
    And I mark the page
    When I alt-click the zoom of "install"
    Then there are 2 panes
    And pane 1 is focused
    When I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    Then the journal chrome is absent
    When I close the focused pane
    Then the address is "/house.olai"
    When I go back
    Then there are 2 panes
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/#install"
    And pane 1 is focused
    When I go forward
    Then there are 1 panes
    And the address is "/house.olai"
    When I go back
    Then pane 1 is focused
    And the zoomed node in pane 1 is "install"
    When I close the focused pane
    And I click the title of "handles"
    And I select all and type "edit after split history"
    And I press "Enter"
    Then "house.olai" holds a node titled "edit after split history"
    And the page has not reloaded
    And there should be no page errors
