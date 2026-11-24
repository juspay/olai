@corpus:good
Feature: Every page starts its first line on one edge
  A page is inset the same way wherever it comes from: `1rem` on a phone, and
  from `md` `2.5rem` at the sides and `2rem` on top. Walking from an outline to
  a day, the Agenda, the Trash and a document, the first line does not jump
  sideways. A plugin's own page keeps its centred column and takes the same
  top. A conversation keeps its own head and inset.

  Scenario: An outline, a day, the Agenda, the Trash and a document share one left edge
    Given I open the outline "house.olai"
    When I note where the page's first line starts
    And I open the day "2026-08-10"
    Then the page's first line starts where the noted one did
    When I open the agenda
    Then the page's first line starts where the noted one did
    When I open the Trash
    Then the page's first line starts where the noted one did
    When I open the document "finishes.md"
    Then the page's first line starts where the noted one did
    And there should be no page errors

  @phone
  Scenario: On a phone the same pages share one left edge
    Given I open the outline "house.olai"
    When I note where the page's first line starts
    And I open the day "2026-08-10"
    Then the page's first line starts where the noted one did
    When I open the agenda
    Then the page's first line starts where the noted one did
    When I open the Trash
    Then the page's first line starts where the noted one did
    When I open the document "finishes.md"
    Then the page's first line starts where the noted one did
    And there should be no page errors
