Feature: the outline, live

  The page watches the file it was drawn from. Whoever saves it — an editor,
  an agent, `olai add` — every open page follows within a couple of seconds,
  and nobody reloads anything.

  Scenario: a title saved to the file shows up on a page nobody touched
    When I open the home page
    And I mark this page load
    And I add the title "Water the plants" to the outline
    Then I see the title "Water the plants"
    And the page has not reloaded

  Scenario: a title deleted from the file leaves the page the same way
    When I open the home page
    Then I see the title "Write the tests"
    And I mark this page load
    And I remove the title "Write the tests" from the outline
    Then "Write the tests" leaves the page
    And I see the title "Ship the server"
    And the page has not reloaded
