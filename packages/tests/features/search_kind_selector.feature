@scratch:good
Feature: Search can narrow to nodes or files for the session
  Background:
    Given I rewrite "zinnia.olai" as:
      """
      {"id":"kind-node","ord":"a0","title":"Keep a note","desc":"zinnia"}
      """
    And I rewrite "zinnia.md" as:
      """
      # zinnia
      """
    And I open the outline "house.olai"

  Scenario: Kind is applied before the cap and survives closing the palette
    When I press the palette shortcut
    And I type "zinnia" into the palette
    Then the search segment "Nodes" shows count 1
    And the search segment "Files" shows count 2
    When I pick search kind "Nodes"
    Then the palette lists the node "Keep a note"
    And the palette lists no document "zinnia.md"
    And the palette lists no document "zinnia.olai"
    When I press "Escape"
    And I press the palette shortcut
    Then search kind "Nodes" is selected

  Scenario: Tab cycles kinds while the caret remains in the box
    When I press the palette shortcut
    And I type "zinnia" into the palette
    And I press "Tab"
    Then search kind "Nodes" is selected
    When I press "Tab"
    Then search kind "Files" is selected
    When I press "Tab"
    Then search kind "All" is selected

  @phone
  Scenario: A phone can ask for files even when no file has a work mark
    When I press the palette shortcut
    And I type "is:done" into the palette
    And I pick search kind "Files"
    Then the palette found "0 matches"
    And search kind "Files" is selected
    And there should be no page errors

  Scenario: Header and palette share the pick and a plugin rebuild resets it
    When I search the header for "zinnia"
    And I pick search kind "Files"
    Then the header search lists the document "zinnia.md"
    When I press "Escape"
    And I press the palette shortcut
    Then search kind "Files" is selected
    When I press "Escape"
    And I open the plugins panel
    And I switch the plugin "search" off
    And I switch the plugin "search" on
    And I close the plugins panel
    And I press the palette shortcut
    Then search kind "All" is selected

  Scenario: A reconnect keeps the selected kind and re-asks it
    When I press the palette shortcut
    And I type "zinnia" into the palette
    And I pick search kind "Nodes"
    Then the palette lists the node "Keep a note"
    When the browser goes offline
    Then the connection is "reconnecting"
    When the browser comes back online
    Then the connection is "live"
    And search kind "Nodes" is selected
    And the palette lists the node "Keep a note"
    And the palette lists no document "zinnia.md"
