@share-scratch
Feature: A wikilink in a row's title or note is a link
  A row's title and its note are prose, so `[[finishes]]` in either is drawn
  as a link to the note its name finds. The title is still edited as it was
  written, brackets and all, and a row that wikilinks a note is listed on that
  note's page.

  @corpus:wikilinks
  Scenario: A wikilink in a row's title draws as a link and opens its note
    Given I open the outline "house.olai"
    Then the title of "kitchen" links to "/finishes.md"
    When I click the wikilink "finishes"
    Then the address is "/finishes.md"
    And there should be no page errors

  @corpus:wikilinks
  Scenario: A wikilink in a row's note draws as its words and opens the heading
    Given I open the outline "house.olai"
    When I open the note of "sink"
    Then the wikilink "the sink table" opens "/kitchen-sink.md#tables"
    When I click the wikilink "the sink table"
    Then the address is "/kitchen-sink.md#tables"
    And there should be no page errors

  @scratch:wikilinks
  Scenario: The title is edited as written, and drawn as a link again after
    Given I open the outline "house.olai"
    When I click the title of "kitchen"
    Then the row being typed holds "kitchen remodel with [[finishes]]"
    When I type " and [[nowhere]]"
    And I click away from the editor
    Then "house.olai" holds a node titled "kitchen remodel with [[finishes]] and [[nowhere]]"
    And the title of "kitchen" links to "/finishes.md"
    And the wikilink "nowhere" is marked unresolved
    And there should be no page errors

  @scratch:wikilinks
  Scenario: A row that gains a wikilink is listed on the note's page
    Given I open the outline "house.olai"
    When I click the title of "shed"
    And I type " by [[greenhouse]]"
    And I click away from the editor
    Then "house.olai" holds a node titled "paint the shed by [[greenhouse]]"
    When I open the document "Greenhouse.md"
    And I open what points at the document
    Then what points at the document is "Every form, paint the shed by greenhouse"
    And there should be no page errors
