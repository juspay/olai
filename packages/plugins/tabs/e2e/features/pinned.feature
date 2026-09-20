Feature: The strip reserves its place above the reading
  @corpus:good
  Scenario: A section pins below the strip
    Given I open the outline "house.olai"
    And I show the done nodes
    And the window is shorter than the page
    And I read the outline with Notes on "open"
    When I scroll to the bottom of the page
    Then the tab strip is pinned below the app header
    And the section heading of "kitchen" is pinned under the main-column chrome
    And there should be no page errors

  @corpus:good
  Scenario: A heading jump clears the strip
    Given I open the document "kitchen-sink.md"
    When I follow the contents line "Lists"
    Then the heading "Lists" lands below the tab strip
    And there should be no page errors

  @corpus:good
  Scenario: Split panes fill the remaining viewport
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    Then there are 2 panes
    And the tab strip is pinned below the app header
    And the split fills the viewport below the tab strip
    And there should be no page errors

  @corpus:good @phone
  Scenario: Phone sections reserve only the header
    Given I open the outline "house.olai"
    And I show the done nodes
    And the window is shorter than the page
    And I read the outline with Notes on "open"
    When I scroll to the bottom of the page
    Then there is no tab strip
    And the main-column reserve equals the visible chrome
    And the section heading of "kitchen" is pinned under the main-column chrome
    And there should be no page errors

  @agent-review @scratch:chat
  Scenario: A long chat page keeps the tabs reachable
    Given I open the plain node composer for "install"
    When I send "hello" from the plain node composer
    Then the node page conversation is ready for "install"
    And the agent is idle
    When I ask for a tall page answer
    Then the agent is idle
    And the page transcript is unbounded and its composer is on screen
    When I scroll to the bottom of the page
    Then the page is at the bottom
    And the tab strip is pinned below the app header
    When I press the new tab button
    Then tab 1 is in front
    And the address is "/"
    And there should be no page errors

  @scratch:good
  Scenario: A split outline section pins at its own scrollport
    Given a long outline for pinned chrome
    And I open the outline "pinned-chrome.olai"
    When I alt-click the zoom of "pinned-root"
    Then there are 2 panes
    When I scroll pane 0 to its middle
    Then pane 0 pins its section heading to its scrollport
    And there should be no page errors

  @scratch:good
  Scenario: A split node header pins at its own scrollport
    Given a long outline for pinned chrome
    And I open the outline "pinned-chrome.olai"
    When I alt-click the zoom of "pinned-root"
    Then there are 2 panes
    When I scroll pane 1 to its middle
    Then pane 1 pins its node heading to its scrollport
    And there should be no page errors

  @scratch:good
  Scenario: A lone node header pins below the strip
    Given a long outline for pinned chrome
    And I open the node "pinned-root"
    And the window is shorter than the page
    When I scroll to the bottom of the page
    Then the lone node header pins below the strip
    And there should be no page errors

  @scratch:good
  Scenario: An upward menu on a scrolled lone page clears the strip
    Given a long outline for pinned chrome
    And I open the outline "pinned-chrome.olai"
    And the window is shorter than the page
    When I position reading row 20 for an upward menu in pane 0
    Then the upward menu of reading row 20 in pane 0 clears the strip and uses the viewport reserve
    And there should be no page errors

  @scratch:good
  Scenario: An upward menu escapes a split pane's local chrome offset
    Given a long outline for pinned chrome
    And I open the outline "pinned-chrome.olai"
    And the window is shorter than the page
    When I alt-click the zoom of "pinned-root"
    Then there are 2 panes
    When I position reading row 20 for an upward menu in pane 0
    Then the upward menu of reading row 20 in pane 0 clears the strip and uses the viewport reserve
    And there should be no page errors

  @scratch:good
  Scenario: A lifted tip below the strip respects its floor
    Given a long blocked heading for a lifted tip
    And I open the outline "pinned-tip.olai"
    And the window is shorter than the page
    When I hover the blocked heading just below the strip
    Then the lifted tip stays below the strip
    And there should be no page errors

  @scratch:chat
  Scenario Outline: Legacy <width> dock preferences do not recreate a covering panel
    Given legacy dock preferences are open and <width>
    And I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then chat remains in the reading below the strip with no dock
    And there should be no page errors

    Examples:
      | width   |
      | wide    |
      | maximum |
