@scratch:good
Feature: Navigation owns the palette shortcut before its layout arrives
  Scenario: A shortcut without layout is preserved until the palette can render
    Given the vault defines a non-UI host management controller
    And I open the node "mint"
    When I open the plugins panel
    And I approve the plugin "management-controller"
    And I close the plugins panel
    And the non-UI controller sets plugin "layout" off
    Then the browser mount has no rendered application
    When I press "ControlOrMeta+k" without waiting
    And the non-UI controller sets plugin "layout" on
    Then the command palette is open
    And the palette input has keyboard focus
    And the palette offers "Mark: Done"
    When I choose "Mark: Done" from the palette
    Then "garden.olai" holds a node marked done titled "split the mint"
    And there should be no page errors

  Scenario: Opening a node waits for the frozen connection before the first shortcut
    Given I open the node "order"
    When I open the node "mint" through a held reconnect
    # Reconnection thaws shortcuts before the next page reading arrives. The
    # previous page deliberately stays painted until then; act on the new one.
    Then the zoomed node is "mint"
    When I press "ControlOrMeta+k"
    Then the command palette is open
    And the palette offers "Mark: Done"
    When I choose "Mark: Done" from the palette
    Then "garden.olai" holds a node marked done titled "split the mint"
    And "house.olai" holds a node marked doing titled "order the new cabinets"
    And there should be no page errors
