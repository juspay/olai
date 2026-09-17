@scratch:good
Feature: Preferences remain usable when the browser cannot remember them
  Scenario: Unavailable local storage permits temporary preferences and ordinary document saves
    Given this browser refuses local storage
    And I open the document "finishes.md"
    Then the page names no theme
    When I pick the theme "pitch"
    And I set Size to "larger"
    Then the page is in the theme "pitch"
    And the page is set at "20px"
    When I press "Escape"
    And I start editing the document
    And I retype the document as:
      """
      **saved without browser storage**
      """
    And I save the document
    Then the document renders bold text "saved without browser storage"
    When I reload the page
    Then the page names no theme
    And the document renders bold text "saved without browser storage"
    And there should be no page errors
