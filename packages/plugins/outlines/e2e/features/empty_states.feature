Feature: A page with nothing on it offers the next step
  An empty page that only says it is empty leaves a person to guess what to
  do. So the page says what is missing in a short sentence, and offers the one
  button that does the obvious thing next: with no outlines at all, `New
  outline`; on a path that names nothing, `Go home`.

  `New outline` does not draw a box of its own. It opens the sidebar's
  new-file box — the same one the sidebar's `+` › New outline opens — through
  the files row's own controls, so there is one box to learn and one place a
  new outline is named.

  @scratch:empty
  Scenario: No outlines yet, and New outline opens the sidebar's own box
    Given the served directory holds no file at all
    And I open the app
    And I mark the page
    Then the empty page says "No outlines yet"
    When I press New outline on the empty page
    Then the new outline box has the caret
    When I create the outline "first.olai" from the sidebar
    Then the address is "/first.olai"
    When I start the first line
    And I type "the first task"
    And I click away from the editor
    Then "first.olai" holds a node titled "the first task"
    And the page has not reloaded
    And there should be no page errors

  @corpus:good
  Scenario: A path that names nothing says so, and Go home goes home
    Given I open the address "/nothing-here.olai"
    And I mark the page
    Then the empty page says "Page not found"
    And the empty page offers no New outline
    When I press Go home on the empty page
    Then the address is "/"
    And the page has not reloaded
    And there should be no page errors
