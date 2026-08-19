@corpus:good
Feature: The second pane
  A pane is a route. The split view is a list of those routes in the URL,
  each drawn with the same page chrome a lone view has. Focus is explicit.
  A plain click navigates the pane you are in; Alt+click opens to the right
  (reusing that neighbour; Alt+Shift+click forces a new one). Closing the
  second-to-last pane returns to a plain page. Below a minimum width a pane
  collapses to a rail. On a narrow screen the same list is a tab strip.

  Scenario: Alt-click opens a node in the pane to the right
    Given I open the outline "house.olai"
    And I mark the page
    When I alt-click the zoom of "install"
    Then there are 2 panes
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/#install"
    And pane 1 is focused
    And the zoomed node in pane 1 is "install"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A plain click navigates the pane you are in
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    And I zoom into the node "kitchen" in pane 0
    Then there are 2 panes
    And pane 0 is showing "/#kitchen"
    And pane 1 is showing "/#install"
    And pane 0 is focused

  Scenario: Alt-click reuses the pane to the right
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    And I alt-click the zoom of "kitchen" in pane 0
    Then there are 2 panes
    And pane 1 is showing "/#kitchen"
    And pane 1 is focused

  Scenario: Alt-shift-click forces a new pane
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    And I alt-shift-click the zoom of "kitchen"
    Then there are 3 panes
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/#kitchen"
    And pane 2 is showing "/#install"
    And pane 1 is focused

  Scenario: Focus moves with a click and with Alt+Left / Alt+Right
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    Then pane 1 is focused
    When I focus pane 0
    Then pane 0 is focused
    When I press Alt+Right
    Then pane 1 is focused
    When I press Alt+Right
    Then pane 0 is focused

  Scenario: Closing the second-to-last pane returns to a plain page
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    Then there are 2 panes
    When I close the focused pane
    Then there are 1 panes
    And pane 0 is showing "/house.olai"
    And the address is exactly "/house.olai"

  Scenario: A split restores from its address
    When I open the address "/s/o%2Fhouse.olai/n%2Finstall?f=1"
    Then there are 2 panes
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/#install"
    And pane 1 is focused
    When I reload the page
    Then there are 2 panes
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/#install"
    And pane 1 is focused
    And there should be no page errors

  Scenario: A pane below the minimum width collapses to a rail
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    And I collapse pane 1 by dragging its divider
    Then a pane rail is shown for pane 1
    When I expand the pane rail 1
    Then there are 2 panes
    And pane 1 is showing "/#install"

  Scenario: On a narrow screen the panes are tabs
    When I open the address "/s/o%2Fhouse.olai/n%2Finstall?f=1"
    And I shrink the window to a phone
    Then the pane tabs are shown
    And there are 2 pane tabs
    And there are 1 panes
    And pane 1 is showing "/#install"
    And there should be no page errors

  Scenario: Tapping a tab switches the page, and closing it returns to a plain page
    When I open the address "/s/o%2Fhouse.olai/n%2Finstall?f=1"
    And I shrink the window to a phone
    Then pane 1 is showing "/#install"
    When I tap pane tab 0
    Then pane 0 is showing "/house.olai"
    And pane 0 is focused
    When I close the focused pane from the keyboard
    Then there are 1 panes
    And pane 0 is showing "/#install"
    And the address is exactly "/#install"
    And there should be no page errors

  Scenario: Alt-click reuse expands a collapsed neighbour
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    And I collapse pane 1 by dragging its divider
    Then a pane rail is shown for pane 1
    When I alt-click the zoom of "kitchen" in pane 0
    Then there are 2 panes
    And pane 1 is showing "/#kitchen"
    And pane 1 is focused
    And no pane rail is shown

  Scenario: On a lone page Alt+Right reaches the editor
    Given I open the outline "house.olai"
    When I click the title of "install"
    And I press Alt+Right without the page claiming it
    Then the row "install" holds the caret
    And the address is exactly "/house.olai"
