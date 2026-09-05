@scratch:good
Feature: File deletion rechecks the content and references that arrive while it is being confirmed
  Scenario: A document named after confirmation opens is preserved and can be deleted after the reference is removed
    Given I rewrite "removable.md" as:
      """
      # Keep until unreferenced
      """
    And I open the document "removable.md"
    And I mark the page
    When I press Delete file
    And I rewrite "references.olai" as:
      """
      {"id":"new-owner","ord":"a0","title":"new reference","doc":"removable.md"}
      """
    Then the outline list links to "references.olai"
    When I confirm deleting the file
    Then the deletion is refused saying "`removable.md` is still named by `new-owner` (`doc`, references.olai:1) — deleting the file would leave that pointing at nothing. Re-point it, or delete the naming record first."
    And the file "removable.md" has been created
    When I rewrite "references.olai" as:
      """
      {"id":"new-owner","ord":"a0","title":"reference removed"}
      """
    And I click the outline "references.olai"
    Then the node "new-owner" has the title "reference removed"
    When I click the document "removable.md"
    And I press Delete file
    And I confirm deleting the file
    Then the main pane says there is no document "removable.md"
    And the file "removable.md" has not been created
    And the page has not reloaded
    And there should be no page errors

  Scenario: Content arriving in an empty outline removes its armed deletion control
    Given I open the outline "house.olai"
    And I create the outline "retained" from the sidebar
    And I mark the page
    When I press Delete file
    And I rewrite "retained.olai" as:
      """
      {"id":"arrived","ord":"a0","title":"arrived during confirmation"}
      """
    Then the node "arrived" is shown
    And the file's delete is not offered
    When I click the title of "arrived"
    And I select all and type "edit the preserved content"
    And I press "Enter"
    Then "retained.olai" holds a node titled "edit the preserved content"
    And the page has not reloaded
    And there should be no page errors

  @phone
  Scenario: A plugin rebuild on a phone requires a fresh deletion confirmation
    Given I open the document "notes/palette.md"
    And I mark the page
    When I press Delete file
    And I open another browser tab
    And I press the sidebar shortcut
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I press "Escape"
    And I use the original browser tab
    Then the journal chrome is absent
    When I press the sidebar shortcut
    And I press Delete file
    And I cancel deleting the file
    Then the file "notes/palette.md" has been created
    And the document open is "notes/palette.md"
    And the page has not reloaded
    And there should be no page errors

  @phone
  Scenario: Both deletion choices remain reachable for a long document path on a phone
    Given I rewrite "a-very-long-document-filename-with-no-spaces-for-phone-deletion.md" as:
      """
      # Temporary document
      """
    And I open the document "a-very-long-document-filename-with-no-spaces-for-phone-deletion.md"
    When I press Delete file
    Then both file deletion choices fit the screen
    When I cancel deleting the file
    Then the file "a-very-long-document-filename-with-no-spaces-for-phone-deletion.md" has been created
    When I press Delete file
    Then both file deletion choices fit the screen
    When I confirm deleting the file
    Then the main pane says there is no document "a-very-long-document-filename-with-no-spaces-for-phone-deletion.md"
    And the file "a-very-long-document-filename-with-no-spaces-for-phone-deletion.md" has not been created
    And there should be no page errors
