@daily
Feature: The journal, as a month

  Daily.rkt has no entry of its own in the sidebar: a file name was never a way
  into anything, and the days under it are. The month is drawn instead — today
  marked, a day the journal HAS a link to that day's page, a day it has nothing
  for a number and nothing else.

  Every scenario here boots a directory `olai daily` has already written, so
  there is a day node for today and the rest of the month is empty.

  Scenario: today's cell is marked and opens today's page
    When I open the home page
    Then the calendar shows this month
    And today's cell is marked
    And a day the journal has nothing for is not a link
    And no day is marked as the one I am on
    When I put the pointer on today's cell
    And I follow today's cell
    Then I am on a node's own page
    And the main pane is zoomed
    And today's cell is marked as the one I am on

  Scenario: the month header is the way to the whole journal
    When I open the home page
    Then the sidebar does not list "Daily.rkt"
    When I follow the calendar's month
    Then I am on a node's own page
    And the main pane is zoomed
