@scratch:lanes @padi:lanes
Feature: An open terminal follows the node property it represents
  Scenario: Changing the terminal property closes the old screen and opens the new target
    Given I open the outline "lanes.olai"
    And I mark the page
    When I watch the terminal on "door-implement"
    Then a snapshot pane opens on "door-implement"
    And the live screen shows "just check"
    When I rewrite "lanes.olai" as:
      """
      {"id":"lanes","ord":"a0","title":"the lanes"}
      {"id":"lane-door","parent":"lanes","ord":"a0","title":"the terminal door"}
      {"id":"door-implement","parent":"lane-door","ord":"a0","title":"now reviewing","doing":true,"custom":{"terminal":"22222222-2222-4222-8222-222222222222"}}
      """
    Then the terminal row on "door-implement" is awaiting
    And no snapshot pane is open
    When I watch the terminal on "door-implement"
    Then a snapshot pane opens on "door-implement"
    And the live screen shows "open the PR"
    When I watch the terminal on "door-implement"
    Then no snapshot pane is open
    And the page has not reloaded
    And there should be no page errors

  Scenario: Removing and restoring the terminal property gives a usable new viewer
    Given I open the outline "lanes.olai"
    And I mark the page
    When I watch the terminal on "door-implement"
    Then the live screen shows "just check"
    When I rewrite "lanes.olai" as:
      """
      {"id":"lanes","ord":"a0","title":"the lanes"}
      {"id":"door-implement","parent":"lanes","ord":"a0","title":"without a terminal","custom":{"agent-session":"claude"}}
      """
    Then the node "door-implement" has the title "without a terminal"
    Then "door-implement" wears no terminal door at all
    And no snapshot pane is open
    When I rewrite "lanes.olai" as:
      """
      {"id":"lanes","ord":"a0","title":"the lanes"}
      {"id":"door-implement","parent":"lanes","ord":"a0","title":"terminal restored","custom":{"agent-session":"claude","terminal":"11111111"}}
      """
    Then the terminal row on "door-implement" is working
    And no snapshot pane is open
    When I watch the terminal on "door-implement"
    Then a snapshot pane opens on "door-implement"
    And the live screen shows "just check"
    When I watch the terminal on "door-implement"
    Then no snapshot pane is open
    And the page has not reloaded
    And there should be no page errors

  Scenario: Restoring the terminal plugin opens working viewers after disposing an active screen
    Given I open the outline "lanes.olai"
    And I mark the page
    When I watch the terminal on "door-implement"
    Then a snapshot pane opens on "door-implement"
    And the live screen shows "just check"
    When I open the plugins panel
    And I switch the plugin "kolu" off
    Then "door-implement" wears no terminal door at all
    And no snapshot pane is open
    When I switch the plugin "kolu" on
    Then the appliance link reads connected
    And the terminal row on "door-implement" is working
    When I close the plugins panel
    And I watch the terminal on "door-implement"
    Then a snapshot pane opens on "door-implement"
    And the live screen shows "just check"
    When I watch the terminal on "door-implement"
    Then no snapshot pane is open
    When I watch the terminal on "door-review"
    Then a snapshot pane opens on "door-review"
    And the live screen shows "open the PR"
    When I watch the terminal on "door-review"
    Then no snapshot pane is open
    And the page has not reloaded
    And there should be no page errors
