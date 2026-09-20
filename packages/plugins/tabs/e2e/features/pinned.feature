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
