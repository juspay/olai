@scratch:good
Feature: Preference changes from another tab leave unfinished edits usable
  Scenario: Theme and size changes preserve a document draft through repainting and reflow
    Given I open the document "finishes.md"
    And I mark the page
    When I start editing the document
    And I retype the document as:
      """
      **draft through preference changes**
      """
    And I open another browser tab
    And I pick the theme "pitch"
    And I set Size to "larger"
    And I use the original browser tab
    Then the page is in the theme "pitch"
    And the page is set at "20px"
    And the document editor holds text containing "draft through preference changes"
    When I save the document
    Then the document renders bold text "draft through preference changes"
    And the document editor is gone
    And the page has not reloaded
    And there should be no page errors

  Scenario: Changing note density elsewhere preserves the note currently being written
    Given I open the outline "house.olai"
    And I mark the page
    When I click the title of "handles"
    And I press "Shift+Enter"
    And I type "note retained through density changes"
    And I open another browser tab
    And I set Notes to "open"
    And I use the original browser tab
    Then the note of "handles" is being typed
    And the row "order" is open
    When I use the other browser tab
    And I set Notes to "compact"
    And I use the original browser tab
    Then the row "order" is folded
    And the note of "handles" is being typed
    When I press "Shift+Enter"
    Then "house.olai" holds a node whose note ends "note retained through density changes"
    And the note of "handles" is no longer being typed
    And the page has not reloaded
    And there should be no page errors

  Scenario: Resizing text from another tab leaves a parked row in its original position
    Given I open the outline "house.olai"
    And I mark the page
    When I click the title of "handles"
    And I press "Enter"
    Then a new row is being typed
    When I open another browser tab
    And I set Size to "larger"
    And I use the original browser tab
    Then the page is set at "20px"
    And a new row is being typed
    When I click the first new row
    And I type "new row after text reflow"
    And I press "Enter"
    Then "house.olai" holds a node titled "new row after text reflow"
    And the node titled "new row after text reflow" comes before "hinges"
    And the page has not reloaded
    And there should be no page errors
