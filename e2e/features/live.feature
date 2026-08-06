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

  # The update is a MORPH: what did not change in the markup is not replaced
  # in the DOM, so everything the browser hangs off those nodes — where you
  # are, what you have selected, what has focus — is still there afterwards.

  Scenario: scroll survives a live re-swap
    When I open the home page
    And the outline is long enough to scroll
    And I scroll the outline down
    And I add the title "Water the plants" to the outline
    Then I see the title "Water the plants"
    And the outline is where I scrolled it

  Scenario: a text selection survives a live re-swap
    When I open the home page
    And I select the title "Ship the server"
    And I add the title "Water the plants" to the outline
    Then I see the title "Water the plants"
    And "Ship the server" is still selected

  # The other half: a stream that stopped must not look like a quiet
  # afternoon, and a page that was away must not stay behind.

  Scenario: the stream says so when it is down, and catches up when it is back
    When I open the home page
    And I mark this page load
    And the server goes away
    Then the page says it is showing last known state
    When I add the title "Water the plants" to the outline
    And the server comes back
    Then I see the title "Water the plants"
    And the page says nothing about the stream
    And the page has not reloaded
