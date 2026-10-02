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

  Scenario: Shortcuts wait for the requested page after the connection recovers
    Given requested page answers can be held
    And I open the node "order"
    Then the zoomed node is "order"
    When I open the node "mint" through a held reconnect
    Then the zoomed node is "order"
    And page shortcuts leave the retained page untouched
    And "house.olai" holds a node marked doing titled "order the new cabinets"
    When the requested page reading is released
    Then the zoomed node is "mint"
    When I press "ControlOrMeta+k"
    Then the command palette is open
    And the palette offers "Mark: Done"
    When I choose "Mark: Done" from the palette
    Then "garden.olai" holds a node marked done titled "split the mint"
    And "house.olai" holds a node marked doing titled "order the new cabinets"
    And there should be no page errors

  Scenario: An already open palette cannot write the retained node during reconnect
    Given requested page answers can be held
    And I open the node "order"
    Then the zoomed node is "order"
    When I press "ControlOrMeta+k"
    Then the command palette is open
    And the palette offers "Mark: Done"
    When I open the node "mint" through a held reconnect
    Then the zoomed node is "order"
    When I try the retained palette's Mark Done action
    Then "house.olai" holds a node marked doing titled "order the new cabinets"
    When the requested page reading is released
    Then the zoomed node is "mint"
    When I choose "Mark: Done" from the palette
    Then "garden.olai" holds a node marked done titled "split the mint"
    And "house.olai" holds a node marked doing titled "order the new cabinets"
    And there should be no page errors

  Scenario: A healthy connection does not license shortcuts on a retained page
    Given requested page answers can be held
    And I open the node "order"
    Then the zoomed node is "order"
    When I request the node "mint" while its page answer is held
    Then the zoomed node is "order"
    And page shortcuts leave the retained page untouched
    When the requested page reading is released
    Then the zoomed node is "mint"
    When I press "ControlOrMeta+k"
    Then the command palette is open
    When I choose "Mark: Done" from the palette
    Then "garden.olai" holds a node marked done titled "split the mint"
    And "house.olai" holds a node marked doing titled "order the new cabinets"
    And there should be no page errors
