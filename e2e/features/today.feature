Feature: Today, zoomed

  The sidebar's Today link goes to today's day node. Before the first capture
  of the day there is no such node, which is the normal state and not an
  error; once the file has one, the page is that subtree and nothing else.

  Scenario: the sidebar's Today link lands on a day that has not started yet
    When I open the home page
    Then the sidebar links to "/today"
    When I follow the sidebar's Today link
    Then the main pane says there is no day node for today
    And I do not see the title "Buy milk"

  Scenario: a day node in the file is what Today zooms to
    When I add a day node for today holding "Water the plants"
    And I open the Today page
    Then the main pane is zoomed
    And I see the title "Water the plants"
    And I do not see the title "Buy milk"
