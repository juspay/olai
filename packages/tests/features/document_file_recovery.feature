@scratch:good
Feature: An open document recovers when an externally removed file returns
  Scenario: Restoring identical bytes retains a saveable draft without a false conflict
    Given I rewrite "notes/palette.md" as:
      """
      **original version**
      """
    And I open the document "notes/palette.md"
    And I mark the page
    When I start editing the document
    And I retype the document as:
      """
      **retained through identical restoration**
      """
    And I remove the served file "notes/palette.md"
    Then the main pane says there is no document "notes/palette.md"
    When I rewrite "notes/palette.md" as:
      """
      **original version**
      """
    Then the document editor holds text containing "retained through identical restoration"
    When I save the document
    Then the document editor is gone
    And the document renders bold text "retained through identical restoration"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Leaving a missing document does not revive its draft when the file returns
    Given I open the document "notes/palette.md"
    And I mark the page
    When I start editing the document
    And I retype the document as:
      """
      **draft abandoned by navigation**
      """
    And I remove the served file "notes/palette.md"
    Then the main pane says there is no document "notes/palette.md"
    When I click the outline "garden.olai"
    And I rewrite "notes/palette.md" as:
      """
      **restored while reading the garden**
      """
    And I expand the folder "notes"
    Then the document link "notes/palette.md" is shown
    And the node "herbs" is shown
    When I click the document "notes/palette.md"
    Then the document editor is gone
    And the document renders bold text "restored while reading the garden"
    When I start editing the document
    Then the document editor holds no text containing "draft abandoned by navigation"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A missing document returns to a usable reader and editor without reloading
    Given I open the document "notes/palette.md"
    And I mark the page
    When I remove the served file "notes/palette.md"
    Then the main pane says there is no document "notes/palette.md"
    And the document link "notes/palette.md" is hidden
    When I rewrite "notes/palette.md" as:
      """
      **restored from outside**
      """
    Then the document renders bold text "restored from outside"
    And the document link "notes/palette.md" is shown
    When I start editing the document
    And I retype the document as:
      """
      **edited after restoration**
      """
    And I save the document
    Then the document editor is gone
    And the document renders bold text "edited after restoration"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A restored file cannot silently replace an unsaved draft or its conflict baseline
    Given I open the document "notes/palette.md"
    And I mark the page
    When I start editing the document
    And I retype the document as:
      """
      **my unfinished draft**
      """
    And I remove the served file "notes/palette.md"
    Then the main pane says there is no document "notes/palette.md"
    When I rewrite "notes/palette.md" as:
      """
      **a different restored version**
      """
    Then the document editor holds text containing "my unfinished draft"
    And the editor notices the file changed on disk
    When I save the document
    Then the save is refused saying "has changed since it was read"
    And the document editor holds text containing "my unfinished draft"
    When I cancel the document editor
    Then the document renders bold text "a different restored version"
    And the page has not reloaded
    And there should be no page errors
