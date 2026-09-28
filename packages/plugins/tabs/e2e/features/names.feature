@scratch:good
Feature: What a tab is called
  A tab names a document the way the files sidebar does — `garden`, not
  `garden.olai` — and carries the address it holds as its tooltip. A file that
  is not a document keeps its suffix, and two open documents that would say the
  same name are both spelled out.

  Scenario: A document's tab drops the suffix, and its address is on hover
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the document link "finishes.md"
    Then there are 2 tabs
    And tab 0 is titled "house"
    And tab 1 is titled "finishes"
    And tab 1's tooltip is "/finishes.md"
    And the tab strip spells no address
    And there should be no page errors

  Scenario: A file that is not a document keeps its suffix
    Given I open the address "/reports/q3.pdf"
    Then there is 1 tab
    And tab 0 is titled "q3.pdf"
    And tab 0's tooltip is "/reports/q3.pdf"
    And there should be no page errors

  Scenario: Two documents with one name are told apart, and only while both are open
    Given I rewrite "house.md" as:
      """
      # House notes
      """
    And I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the document link "house.md"
    Then there are 2 tabs
    And tab 0 is titled "house.olai"
    And tab 1 is titled "house.md"
    When I close tab 1 with its button
    Then there is 1 tab
    And tab 0 is titled "house"
    And there should be no page errors

  Scenario: A tab's menu copies its address
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I let the page use the clipboard
    And I choose "Copy address" from the menu of tab 1
    Then the clipboard holds the link to "/garden.olai"
    And there are 2 tabs
    And tab 0 is in front
    And there should be no page errors

  Scenario: With the outlines row off, a document tab is still named
    Given I open the outline "house.olai"
    When I open the plugins panel
    And I switch the plugin "outlines" off
    And I close the plugins panel
    And I open the address "/finishes.md"
    Then there is 1 tab
    And tab 0 is titled "finishes"
    And tab 0's tooltip is "/finishes.md"
    When I open the plugins panel
    And I switch the plugin "outlines" on
    And I close the plugins panel
    And I open the outline "garden.olai"
    Then tab 0 is titled "garden"
    And there should be no page errors
