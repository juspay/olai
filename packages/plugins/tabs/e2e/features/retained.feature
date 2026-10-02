@corpus:good
Feature: Tabs retain their pages
  A visited tab owns its mounted pages until it closes. A saved tab starts its
  pages only when it is first shown.

  Scenario: Switching tabs preserves the page and closing it releases it
    Given I open the outline "house.olai"
    When I remember pane 0 as "house"
    And I choose "Open in new tab" from the menu of the outline link "garden.olai"
    Then there are 1 live lanes
    When I press tab 1
    Then there are 2 live lanes
    And remembered pane "house" is mounted
    When I press tab 0
    Then pane 0 is still "house"
    When I close tab 0 with its button
    Then remembered pane "house" is removed
    And there are 1 live lanes
    And there should be no page errors

  Scenario: Splitting and closing a neighbour preserves the original page
    Given I open the outline "house.olai"
    When I filter the page by "cabinets"
    And I remember pane 0 as "house"
    And I alt-click the zoom of "install"
    Then there are 2 panes
    And pane 0 is still "house"
    And pane 0 keeps the filter "cabinets"
    When I close the focused pane
    Then there are 1 panes
    And pane 0 is still "house"
    And pane 0 keeps the filter "cabinets"
    And there should be no page errors

  Scenario: A retained pane survives a rail and both sides of the breakpoint
    Given I open the outline "house.olai"
    When I filter the page by "cabinets"
    And I remember pane 0 as "house"
    And I alt-click the zoom of "install"
    And I collapse pane 0 by dragging its divider
    Then a pane rail is shown for pane 0
    And remembered pane "house" is mounted
    When I expand the pane rail 0
    Then pane 0 is still "house"
    And pane 0 keeps the filter "cabinets"
    When I shrink the window to a phone
    Then there are 1 live lanes
    And remembered pane "house" is mounted
    When I tap pane tab 0
    Then pane 0 is still "house"
    And pane 0 keeps the filter "cabinets"
    When I widen the window to a desk
    Then pane 0 is still "house"
    And pane 0 keeps the filter "cabinets"
    And there should be no page errors

  Scenario: Reload restores saved addresses without opening background pages
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    Then there are 2 live lanes
    When I reload the page
    Then there are 1 live lanes
    And tab 1 is in front
    When I press tab 0
    Then there are 2 live lanes
    And there should be no page errors

  Scenario: A filter belongs to the retained tab
    Given I open the outline "house.olai"
    When I filter the page by "kitchen"
    And I remember pane 0 as "filtered"
    And I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    And I press tab 0
    Then the filter box holds "kitchen"
    And pane 0 is still "filtered"
    And there should be no page errors

  @scratch:good
  Scenario: With the tabs row off only the current lane remains
    Given I open the outline "house.olai"
    When I remember pane 0 as "house"
    And I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    Then there are 2 live lanes
    When I open the plugins panel
    And I switch the plugin "tabs" off
    And I close the plugins panel
    Then there are 1 live lanes
    And remembered pane "house" is removed
    And there should be no page errors

  Scenario: Reordering moves the existing page to its new position
    Given I open the outline "house.olai"
    When I remember pane 0 as "house"
    And I alt-click the zoom of "install"
    And I drag pane header 0 to pane header 1
    Then pane 1 is still "house"
    When I go back
    Then pane 0 is still "house"
    And pane 0 is already drawing the outline "house.olai"
    And there should be no page errors

  @scratch:good
  Scenario: Window scroll survives switching away from a lone page
    Given an outline and a taller document for scroll history
    And I open the outline "scroll-history.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I scroll to the bottom of the page
    And I press tab 1
    And I press tab 0
    Then the page is at the bottom
    And there should be no page errors

  @scratch:good
  Scenario: A hidden selection ignores another tab's bulk keys
    Given I open the outline "house.olai"
    And I show the done nodes
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I pick the title of "handles"
    And I pick the title of "knobs"
    Then 2 rows are picked
    When I press tab 1
    And I press "Escape"
    And I press "Tab"
    And I press "ControlOrMeta+a"
    And I press "ArrowDown"
    And I press "ArrowUp"
    And I press tab 0
    Then 2 rows are picked
    And the row "handles" is picked
    And the row "knobs" is picked
    And there should be no page errors

  @scratch:good
  Scenario: Two tabs share edits while a finished-row reveal stays in its own pane
    Given I open the address "/garden.olai#basil"
    Then the node "basil" is shown
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    Then the node "basil" is not shown
    When I click the title of "mint"
    And I select all and type "mint shared between tabs"
    And I press "Enter"
    And I press "Escape"
    And I press tab 0
    Then the node "mint" has the title "mint shared between tabs"
    And the node "basil" is shown
    And this page's Done flip says "hidden"
    When I press tab 1
    Then the node "basil" is not shown
    And there should be no page errors

  Scenario: A phone adopts the front page and releases other live lanes
    Given I open the outline "house.olai"
    When I remember pane 0 as "background"
    And I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    And I remember pane 0 as "front"
    Then there are 2 live lanes
    When I shrink the window to a phone
    Then there are 1 live lanes
    And pane 0 is still "front"
    And remembered pane "background" is removed
    When I widen the window to a desk
    Then pane 0 is still "front"
    And there are 1 live lanes
    And there should be no page errors

  @scratch:good
  Scenario: A split column keeps a nonzero scroll position across tab switches
    Given an outline and a taller document for scroll history
    And I open the address "/s/scroll-history.olai/garden.olai"
    Then the node "scroll-row-39" is shown
    When I leave pane 0 halfway down
    And I choose "Open in new tab" from the menu of the outline link "house.olai"
    And I press tab 1
    And I press tab 0
    Then pane 0 keeps its nonzero scroll position
    And there should be no page errors

  Scenario: Closing a background tab releases its mounted pages
    Given I open the outline "house.olai"
    When I remember pane 0 as "background"
    And I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    And I close tab 0 with its button
    Then remembered pane "background" is removed
    And there are 1 live lanes
    And the address is "/garden.olai"

  Scenario: Finished controls keep each file's choice across tab switches
    Given I open the outline "house.olai"
    When I show the done nodes
    Then the node "demo" is shown
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    Then this page's Done flip says "hidden"
    And the node "basil" is not shown
    When I press tab 0
    Then this page's Done flip says "shown"
    And the node "demo" is shown
    When I press tab 1
    Then the node "basil" is not shown

  Scenario: An opened note survives a tab switch
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I open the note of "order"
    And I press tab 1
    And I press tab 0
    Then the row "order" is open

  Scenario: An open confirmation keeps its question and focused control
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    Then the node menu's "Move to Trash" has the caret
    When I press tab 1
    And I press tab 0
    Then the node menu asks "Move “install the cabinets” and the 3 rows under it to Trash? You can put them back from Trash in the sidebar."
    And the node menu's "Move to Trash" has the caret
    When I choose "Cancel" from the node menu
    Then the node menu is not asking anything

  Scenario: An open submenu keeps its highlighted entry
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I open the node menu of "kitchen" with the keyboard
    And I press "End"
    And I press "ArrowUp"
    And I press "ArrowRight"
    Then the node menu's "Copy link" has the caret
    When I press tab 1
    And I press tab 0
    Then the node menu's "More" is open
    And the node menu's "Copy link" has the caret

  @scratch:good
  Scenario: A parked draft survives switching tabs and still writes in place
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I click the title of "handles"
    And I press "Enter"
    And I press "Enter"
    Then 2 new rows are being typed
    When I press tab 1
    And I press tab 0
    Then 2 new rows are being typed
    When I click the first new row
    And I type "measure twice"
    And I press "Enter"
    Then "house.olai" holds a node titled "measure twice"
    And the node titled "measure twice" comes before "hinges"

  Scenario: A hidden HTML page retains its frame while another tab is drawn
    Given I open the address "/report.html"
    When I remember pane 0 as "report"
    And I remember the HTML frame
    And I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    Then the remembered HTML frame is mounted but hidden
    When I press tab 0
    Then pane 0 is still "report"
    And the remembered HTML frame is shown unchanged


  Scenario: Closing the left neighbour reindexes the surviving page without losing state
    Given I open the address "/s/garden.olai/house.olai"
    When I focus pane 1
    And I filter the page by "cabinets"
    And I remember pane 1 as "survivor"
    And I focus pane 0
    And I close the focused pane
    Then there are 1 panes
    And pane 0 is still "survivor"
    And pane 0 keeps the filter "cabinets"

  Scenario: A title selection returns with its retained editor
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I click the title of "order"
    And I press "Home"
    And I press "Shift+End"
    Then the selected text in the line is "order the new cabinets"
    When I press tab 1
    And I press tab 0
    Then the selected text in the line is "order the new cabinets"
