@scratch:legacy-pins
Feature: Legacy pins migrate once at the storage boundary
  Scenario: Migration rewrites old titles but later references reveal
    Given I open the outline "house.olai"
    Then "_olai/Pins.olai" holds a node titled "/zoom/#order"
    And "_olai/Pins.olai" holds a node titled "[Old layout](/s/house.olai/zoom%2F%23install)"
    When I follow the pin "/zoom/#order"
    Then the zoomed node is "order"
    When I follow the pin "/s/house.olai/zoom%2F%23install"
    Then there are 2 tabs
    And the zoomed node in pane 1 is "install"
    When the directory grows a pin to "/#order"
    And I follow the pin "/#order"
    Then the focused pane is drawing the outline "house.olai"
    And the unified destination row "order" is selected
    And there should be no page errors
    When the server stops
    And the server starts again on the same port
    Then "_olai/Pins.olai" holds a node titled "/#order"
