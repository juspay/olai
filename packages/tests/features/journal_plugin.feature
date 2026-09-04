@scratch:good @plugins:chat
Feature: The journal is one optional plugin
  Scenario: A serve without journal is an outliner with no journal faces
    Given I open the outline "house.olai"
    Then the journal chrome is absent
    And the connection is "live"

    When I open today
    Then no journal page is drawn
    When I open the agenda
    Then no journal page is drawn

    When I press the palette shortcut
    Then the palette does not offer "Go to today"
    And the palette does not offer "Go to the agenda"
    And there should be no page errors
