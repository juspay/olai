@scratch:good
Feature: Reconnecting preserves unfinished work and its conflict baseline
  Scenario: An unsaved document survives a network outage and can still be saved
    Given I open the document "finishes.md"
    And I mark the page
    When I start editing the document
    And I retype the document as:
      """
      **saved after reconnect**
      """
    And the browser goes offline
    Then the connection is "reconnecting"
    And the app is frozen under the offline overlay
    When the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    And the document editor holds text containing "saved after reconnect"
    When I save the document
    Then the document editor is gone
    And the document renders bold text "saved after reconnect"
    And the page has not reloaded

  Scenario: A document changed during an outage cannot be overwritten by its old draft
    Given I open the document "finishes.md"
    And I mark the page
    When I start editing the document
    And I retype the document as:
      """
      **unsaved local draft**
      """
    And the browser goes offline
    Then the connection is "reconnecting"
    When I rewrite "finishes.md" as:
      """
      **written while offline**
      """
    And the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    And the document editor holds text containing "unsaved local draft"
    And the editor notices the file changed on disk
    When I save the document
    Then the save is refused saying "has changed since it was read"
    And the document editor holds text containing "unsaved local draft"
    When I cancel the document editor
    Then the document renders bold text "written while offline"
    When I start editing the document
    And I retype the document as:
      """
      **saved using the recovered baseline**
      """
    And I save the document
    Then the document renders bold text "saved using the recovered baseline"
    And the page has not reloaded

  Scenario: A parked outline row survives a network outage and can still be filled in
    Given I open the outline "house.olai"
    And I mark the page
    When I click the title of "handles"
    And I press "Enter"
    Then a new row is being typed
    When the browser goes offline
    Then the connection is "reconnecting"
    And the app is frozen under the offline overlay
    When the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    And a new row is being typed
    When I click the first new row
    And I type "measure after reconnect"
    And I press "Enter"
    Then "house.olai" holds a node titled "measure after reconnect"
    And the node titled "measure after reconnect" comes before "hinges"
    And the page has not reloaded
