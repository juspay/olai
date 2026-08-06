Feature: a broken file, under a running server

  A file is broken for a moment during every edit. The page keeps the last
  good content and says where the trouble is, and it takes itself back down
  when the file loads again — all of it without a reload.

  Scenario: breaking the file banners the error and keeps the last good page
    When I open the home page
    And I mark this page load
    And I break the outline
    Then the error banner names the file, with a line and a column
    And I see the title "Buy milk"
    And the page has not reloaded

  Scenario: fixing the file takes the banner back down
    When I open the home page
    And I break the outline
    Then the error banner names the file, with a line and a column
    And I mark this page load
    And I fix the outline
    Then the error banner clears
    And I see the title "Buy milk"
    And the page has not reloaded
