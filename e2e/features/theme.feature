Feature: the theme picker

  The picker in the sidebar is CLIENT state: a chip writes data-theme on
  <html>, this browser keeps it, the sheet repaints, and the browser chrome
  (meta theme-color) follows the paper. Nothing about it reaches the server —
  every scenario here is one fresh browser against the same page.

  Scenario: a fresh browser reads in the default theme
    When I open the home page
    Then the page names no theme
    And the lit theme chip is the default
    And every theme chip agrees with what it announces

  Scenario: picking a dark theme repaints the page
    When I open the home page
    And I note the paper colour
    And I pick the theme "pitch"
    Then the page is in the theme "pitch"
    And the lit theme chip is "pitch"
    And the paper colour has changed

  Scenario: the browser chrome follows the paper
    When I open the home page
    Then the theme-color meta matches the paper
    When I pick the theme "pitch"
    Then the theme-color meta matches the paper

  Scenario: the theme I picked is there before the page has finished parsing
    When I open the home page
    And I pick the theme "pitch"
    And I watch for the theme landing
    And I reload the page
    Then the theme "pitch" landed while the page was still parsing
    And the lit theme chip is "pitch"
    And the theme-color meta matches the paper

  Scenario: picking the default theme is a pick like any other
    When I open the home page
    And I pick the theme "pitch"
    And I pick the default theme
    Then the page is in the default theme
    And the lit theme chip is the default
    When I reload the page
    Then the page is in the default theme
    And the lit theme chip is the default
    And the theme-color meta matches the paper
