@scratch:good
Feature: Alt-click on a link inside a document opens that heading on the right
  A link that stays inside its document — an authored `[x](#slug)` and every
  line of the contents — is the same gesture as a link naming the file: a plain
  click scrolls this page in place, and Alt+click opens the document at that
  heading in the pane to the right (Alt+Shift+click forces a new one).

  Background:
    Given a long document with in-page links is served
    And I open the document "sections.md"

  Scenario: Alt-click on an in-page link opens its heading on the right
    Given I mark the page
    When I alt-click the in-page link "the last section" in pane 0
    Then there are 2 panes
    And pane 0 is showing "/sections.md"
    And pane 1 is showing "/sections.md#last-section"
    And pane 1 is focused
    And the document in pane 1 is scrolled to the heading "Last section"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Alt-click on a line of the contents opens its heading on the right
    When I alt-click the contents line "Middle section" in pane 0
    Then there are 2 panes
    And pane 0 is showing "/sections.md"
    And pane 1 is showing "/sections.md#middle-section"
    And the document in pane 1 is scrolled to the heading "Middle section"
    And there should be no page errors

  Scenario: Alt-click with a pane already on the right reuses it
    When I alt-click the in-page link "the last section" in pane 0
    Then pane 1 is showing "/sections.md#last-section"
    When I alt-click the contents line "Middle section" in pane 0
    Then there are 2 panes
    And pane 1 is showing "/sections.md#middle-section"
    And pane 1 is focused
    And the document in pane 1 is scrolled to the heading "Middle section"

  Scenario: Alt-Shift-click forces a new pane
    When I alt-click the in-page link "the last section" in pane 0
    And I alt-shift-click the contents line "Middle section" in pane 0
    Then there are 3 panes
    And pane 0 is showing "/sections.md"
    And pane 1 is showing "/sections.md#middle-section"
    And pane 2 is showing "/sections.md#last-section"
    And pane 1 is focused

  Scenario: A plain click on an in-page link still scrolls in place
    Given I mark the page
    When I click the in-page link "the last section"
    Then there are 1 panes
    And the address names the heading "Last section"
    # Where the reader ended up, not a pixel budget for the jump: the heading
    # starts forty paragraphs down, so being at the top means the page moved.
    And the document is scrolled to the heading "Last section"
    And the page has not reloaded
