@scratch:good
Feature: Native clipboard paste preserves plain text and selected-range replacements
  Scenario: Pasting into a selected title replaces that range and remains undoable
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I select "the" in the line
    And I paste this text into the focused field:
      """
      **brass** 日本語
      """
    Then the row being typed holds "choose **brass** 日本語 handles"
    When I click away from the editor
    Then the node "handles" has the title "choose brass 日本語 handles"
    And "house.olai" holds a node titled "choose **brass** 日本語 handles"
    When I press "ControlOrMeta+z"
    Then the node "handles" has the title "choose the handles"
    And there should be no page errors

  Scenario: Multiline paste replaces a selected note word and preserves the surrounding lines
    Given I rewrite "paste-note.olai" as:
      """
      {"id":"paste-note","ord":"a0","title":"note","desc":"first line\nchoose the handles"}
      """
    And I open the outline "paste-note.olai"
    When I open the note of "paste-note"
    And I click the note of "paste-note"
    And I select "the" backwards in the note
    And I paste this text into the focused field:
      """
      brass
      日本語
      """
    And I click away from the editor
    Then the note of "paste-note" in "paste-note.olai" is:
      """
      first line
      choose brass
      日本語 handles
      """
    When I press "ControlOrMeta+z"
    Then "paste-note.olai" holds a node whose note ends "choose the handles"
    And there should be no page errors

  Scenario: A pasted document keeps paragraph breaks and markdown through save and reopening
    Given I open the document "finishes.md"
    When I start editing the document
    And I press "ControlOrMeta+a"
    And I paste this text into the focused field:
      """
      # Pasted document

      **日本語** and brass.

      Last paragraph.
      """
    And I save the document
    Then the document renders bold text "日本語"
    When I start editing the document
    Then the focused text field holds:
      """
      # Pasted document

      **日本語** and brass.

      Last paragraph.
      """
    And there should be no page errors
