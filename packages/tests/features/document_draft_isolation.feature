@scratch:good
Feature: Document drafts stay with their reader through a plugin rebuild
  Scenario: Phone tabs showing the same document keep separate editor lifetimes
    Given I open the address "/s/finishes.md/finishes.md"
    When I shrink the window to a phone
    And I start editing the document
    And I retype the document as:
      """
      left phone draft
      """
    And I tap pane tab 1
    Then the document editor is gone
    When I start editing the document
    And I retype the document as:
      """
      right phone draft
      """
    And I tap pane tab 0
    Then the document editor holds text containing "left phone draft"
    And the document editor holds no text containing "right phone draft"
    When I tap pane tab 1
    Then the document editor holds text containing "right phone draft"
    When I cancel the document editor
    And I tap pane tab 0
    Then the document editor holds text containing "left phone draft"
    When I tap pane tab 1
    Then the document editor is gone
    And there should be no page errors

  Scenario: Two panes of the same file keep separate drafts and detect the other save
    Given I open the address "/s/finishes.md/finishes.md"
    Then there are 2 panes
    When I draft "left draft" in document pane 0
    And I draft "right draft" in document pane 1
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    Then document pane 0 holds draft "left draft"
    And document pane 1 holds draft "right draft"
    When I save document pane 0
    Then document pane 0 has no editor
    And the editor notices the file changed on disk
    When I save document pane 1
    Then the save is refused saying "has changed since it was read"
    And document pane 1 holds draft "right draft"
    And there should be no page errors

  Scenario: A plugin change in another tab preserves both drafts and their conflict baseline
    Given I open the document "finishes.md"
    When I start editing the document
    And I retype the document as:
      """
      **first tab**
      """
    Given a second tab opens the document "finishes.md"
    When I switch to the other document tab
    And I start editing the document
    And I retype the document as:
      """
      **second tab**
      """
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    Then the document editor holds text containing "second tab"
    When I switch to the other document tab
    Then the document editor holds text containing "first tab"
    When I save the document
    Then the document editor is gone
    And the document renders bold text "first tab"
    When I switch to the other document tab
    Then the editor notices the file changed on disk
    When I save the document
    Then the save is refused saying "has changed since it was read"
    And the document editor holds text containing "second tab"
    When I cancel the document editor
    Then the document renders bold text "first tab"
    And there should be no page errors
