@scratch:good
Feature: A pasted document draft remains editable through native Undo and save conflicts
  Background:
    Given I rewrite "paste-conflict.md" as:
      """
      # Original document

      Original paragraph.
      """
    And I open the document "paste-conflict.md"
    And I mark the page
    When I start editing the document
    And I press "ControlOrMeta+a"
    And I paste this text into the focused field:
      """
      # Pasted draft

      **日本語** from the clipboard.
      """

  Scenario: Native Undo and Redo preserve a pasted draft which can explicitly overwrite a conflict
    When I press "ControlOrMeta+z"
    Then the document editor holds text containing "Original paragraph."
    And the document editor holds no text containing "from the clipboard"
    When I press "ControlOrMeta+Shift+z"
    Then the focused text field holds:
      """
      # Pasted draft

      **日本語** from the clipboard.
      """
    When I rewrite "paste-conflict.md" as:
      """
      # Changed externally

      **external** paragraph.
      """
    Then the editor notices the file changed on disk
    When I save the document
    Then the save is refused saying "has changed since it was read"
    And the document editor holds text containing "**日本語** from the clipboard."
    When I overwrite the document anyway
    Then the document renders bold text "日本語"
    And the document editor is gone
    When I start editing the document
    Then the focused text field holds:
      """
      # Pasted draft

      **日本語** from the clipboard.
      """
    And the page has not reloaded
    And there should be no page errors

  Scenario: Cancelling a refused pasted draft reveals the external version and permits another edit
    When I rewrite "paste-conflict.md" as:
      """
      # Changed externally

      **external** paragraph.
      """
    Then the editor notices the file changed on disk
    When I save the document
    Then the save is refused saying "has changed since it was read"
    When I cancel the document editor
    Then the document renders bold text "external"
    When I start editing the document
    Then the document editor holds no text containing "from the clipboard"
    When I press "ControlOrMeta+a"
    And I paste this text into the focused field:
      """
      # Resolved document

      **resolved** from a new draft.
      """
    And I save the document
    Then the document renders bold text "resolved"
    And the document editor is gone
    And the page has not reloaded
    And there should be no page errors
