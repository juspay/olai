@scratch:good
Feature: A link to a heading inside its own document has the link menu
  A link that stays inside its document — an authored `[x](#slug)` and every
  line of the contents — is a page-local fragment, so a plain click scrolls in
  place. Its right-click menu still opens the page it stands for: Open in new
  tab puts the document at that heading in a tab behind, and Open is the
  link's own click.

  Background:
    Given a long document with in-page links is served
    And I open the document "sections.md"

  Scenario: Open in new tab on an in-page link opens its heading behind
    Given I mark the page
    When I choose "Open in new tab" from the menu of the in-page link "the last section"
    Then there are 2 tabs
    And tab 0 is in front
    And tab 1 holds "/sections.md#last-section"
    And the address is "/sections.md"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Open in new tab on a contents line opens its heading behind
    When I choose "Open in new tab" from the menu of the contents line "Middle section"
    Then there are 2 tabs
    And tab 0 is in front
    And tab 1 holds "/sections.md#middle-section"
    And there should be no page errors

  Scenario: Open from an in-page link's menu still scrolls in place
    Given I mark the page
    When I choose "Open" from the menu of the in-page link "the last section"
    Then there is 1 tab
    And the address names the heading "Last section"
    And the document is scrolled to the heading "Last section"
    And the page has not reloaded
