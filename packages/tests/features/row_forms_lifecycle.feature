@scratch:good
Feature: Row forms retain drafts and submission state across page changes
  Scenario: A refused repeat keeps its choice and reason across phone pane switches
    Given I open the address "/s/house.olai/house.olai"
    When I shrink the window to a phone
    And I hold a finger on the node "order"
    And I choose "Set repeat…" from the node menu
    And I draft the repeat rule "every month"
    And I open another browser tab
    And I open the date picker on "order"
    And I empty the date picker
    And I press the date picker's button
    Then "house.olai" holds the node "order" with no date
    When I use the original browser tab
    And I press the repeat picker's button
    Then the repeat picker refuses with "invalid, so nothing was written"
    When I tap pane tab 1
    And I tap pane tab 0
    Then the repeat picker holds "every month"
    And the repeat picker refuses with "invalid, so nothing was written"
    When I hold a finger on the node "order"
    And I choose "Set date…" from the node menu
    And I pick the date "2026-10-14"
    And I press the repeat picker's button
    Then the repeat picker is closed
    And the node "order" shows the repeat rule "every month"
    And there should be no page errors

  Scenario: A late date response cannot close a newly opened draft
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I open the date picker on "order"
    And I draft the date "2026-10-14"
    And I hold incoming updates to the original browser tab
    And I submit the date while updates are delayed
    And I press "Escape"
    Then the date picker is closed
    When I open the date picker on "order"
    And I draft the date "2026-11-18"
    And I release incoming updates to the original browser tab
    Then "house.olai" holds the node "order" dated "2026-10-14"
    And the date picker holds "2026-11-18"
    When I press the date picker's button
    Then the date picker is closed
    And "house.olai" holds the node "order" dated "2026-11-18"
    And there should be no page errors

  Scenario: A pending date submission stays disabled across phone pane switches
    Given incoming updates to this browser tab can be held
    And I open the address "/s/house.olai/house.olai"
    When I shrink the window to a phone
    And I open the date picker on "order"
    And I draft the date "2026-10-14"
    And I hold incoming updates to the original browser tab
    And I submit the date while updates are delayed
    Then the date picker's button is dead
    When I tap pane tab 1
    And I tap pane tab 0
    Then the date picker holds "2026-10-14"
    And the date picker's button is dead
    When I release incoming updates to the original browser tab
    Then the date picker is closed
    And "house.olai" holds the node "order" dated "2026-10-14"
    And there should be no page errors

  Scenario: A date draft survives a plugin change in another browser tab
    Given I open the outline "house.olai"
    When I filter the page by "order"
    And I open the date picker on "order"
    And I draft the date "2026-10-14"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "identity" off
    And I close the plugins panel
    And I use the original browser tab
    Then the date picker is open
    And the date picker holds "2026-10-14"
    When I press the date picker's button
    Then "house.olai" holds the node "order" dated "2026-10-14"
    And the date picker is closed
    And there should be no page errors

  Scenario: Collapsing the parent discards its hidden row's date draft
    Given I open the outline "house.olai"
    When I open the date picker on "order"
    And I draft the date "2026-10-14"
    And I collapse the node "kitchen"
    Then the date picker is closed
    When I expand the node "kitchen"
    Then the date picker is closed
    When I open the date picker on "order"
    Then the date picker holds "2026-08-10"
    And there should be no page errors

  Scenario: A repeat draft survives a plugin change and can still be applied
    Given I open the outline "house.olai"
    When I open the node menu of "order"
    And I choose "Set repeat…" from the node menu
    And I draft the repeat rule "every month"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "identity" off
    And I close the plugins panel
    And I use the original browser tab
    Then the repeat picker is open
    And the repeat picker holds "every month"
    When I pick the repeat rule "every month"
    Then the node "order" shows the repeat rule "every month"
    And the repeat picker is closed
    And there should be no page errors

  Scenario: A cancelled date draft stays closed across the next rebuild
    Given I open the outline "house.olai"
    When I open the date picker on "order"
    And I draft the date "2026-10-14"
    And I press "Escape"
    Then the date picker is closed
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "identity" off
    And I close the plugins panel
    And I use the original browser tab
    Then the date picker is closed
    When I open the date picker on "order"
    Then the date picker holds "2026-08-10"
    And there should be no page errors

  Scenario: Explicit navigation discards an unsubmitted date draft
    Given I open the outline "house.olai"
    When I open the date picker on "order"
    And I draft the date "2026-10-14"
    And I click the outline "garden.olai"
    And I click the outline "house.olai"
    Then the date picker is closed
    When I open the date picker on "order"
    Then the date picker holds "2026-08-10"
    And there should be no page errors

  Scenario: Phone panes of the same outline keep independent date drafts
    Given I open the address "/s/house.olai/house.olai"
    When I shrink the window to a phone
    And I open the date picker on "order"
    And I draft the date "2026-10-14"
    And I tap pane tab 1
    Then the date picker is closed
    When I open the date picker on "order"
    And I draft the date "2026-11-18"
    And I tap pane tab 0
    Then the date picker holds "2026-10-14"
    When I press "Escape"
    And I tap pane tab 1
    Then the date picker holds "2026-11-18"
    When I press the date picker's button
    Then "house.olai" holds the node "order" dated "2026-11-18"
    When I tap pane tab 0
    Then the date picker is closed
    And there should be no page errors
