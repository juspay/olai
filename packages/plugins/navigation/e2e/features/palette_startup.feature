@scratch:good
Feature: Page actions wait for their reading while navigation stays available
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
    And the retained page shows its loading cue
    And browser keys and outside typing remain available
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
    Then the open palette has no retained page actions
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
    And the retained page shows its loading cue
    And browser keys and outside typing remain available
    When the requested page reading is released
    Then the zoomed node is "mint"
    When I press "ControlOrMeta+k"
    Then the command palette is open
    When I choose "Mark: Done" from the palette
    Then "garden.olai" holds a node marked done titled "split the mint"
    And "house.olai" holds a node marked doing titled "order the new cabinets"
    And there should be no page errors

  Scenario: A link on the retained page can leave a request that never answers
    Given requested page answers can be held
    And I open the node "order"
    Then the zoomed node is "order"
    When I request the node "mint" while its page answer is held
    Then the retained page shows its loading cue
    When I click the retained page link to "kitchen"
    Then the zoomed node is "kitchen"
    When I press "ControlOrMeta+k"
    Then the palette offers "Mark: Done"
    And there should be no page errors

  Scenario: Back can leave a request that never answers
    Given requested page answers can be held
    And I open the node "order"
    Then the zoomed node is "order"
    When I click the retained page link to "kitchen"
    Then the zoomed node is "kitchen"
    When I request the node "mint" while its page answer is held
    And I go back
    Then the zoomed node is "kitchen"
    When I press "ControlOrMeta+k"
    Then the palette offers "Mark: Done"
    And there should be no page errors

  Scenario: A failed request stays read-only but does not trap navigation
    Given requested page answers can be held
    And I open the node "order"
    Then the zoomed node is "order"
    When I request the node "mint" while its page answer is held
    And the requested page reading fails
    Then the retained page reports the failed request
    And page shortcuts leave the retained page untouched
    And browser keys and outside typing remain available
    When I click the retained page link to "kitchen"
    Then the zoomed node is "kitchen"
    When I press "ControlOrMeta+k"
    Then the palette offers "Mark: Done"
    And only the injected page failure was reported

  Scenario: Measure the pending interval during normal local navigation
    Given I open the node "order"
    Then the zoomed node is "order"
    And normal node navigation records its pending intervals
    And there should be no page errors

  Scenario: A pending confirmation cannot write the previous page
    Given requested page answers can be held
    And I open the node "install"
    Then the zoomed node is "install"
    When I press "ControlOrMeta+k"
    And I choose "Move to Trash" from the palette
    Then the palette's caret is on "go"
    When I open the node "mint" through a held reconnect
    And I press "Enter" without waiting
    Then the palette remarks "Loading…"
    And "house.olai" holds a node titled "install the cabinets"
    When I press "Escape"
    And I press "Escape"
    And the requested page reading is released
    Then the zoomed node is "mint"
    And there should be no page errors

  Scenario: The retained row is read-only without cancelling browser or escape keys
    Given requested page answers can be held
    And I open the node "kitchen"
    Then the zoomed node is "kitchen"
    When I click the title of "order"
    And I request the node "mint" while its page answer is held
    Then the retained row refuses edits but keeps browser and escape keys
    When the requested page reading is released
    Then the zoomed node is "mint"
    And "house.olai" holds a node marked doing titled "order the new cabinets"
    And there should be no page errors

  Scenario: Bulk shortcuts cannot edit a retained selection
    Given requested page answers can be held
    And I open the node "kitchen"
    Then the zoomed node is "kitchen"
    When I pick the title of "order"
    Then 1 rows are picked
    When I request the node "mint" while its page answer is held
    And I press "ControlOrMeta+Enter" without waiting
    And the requested page reading is released
    Then the zoomed node is "mint"
    And "house.olai" holds a node marked doing titled "order the new cabinets"
    And there should be no page errors
