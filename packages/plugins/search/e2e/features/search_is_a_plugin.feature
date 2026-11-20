@scratch:good
Feature: The matcher is a plugin
  Search owns its matcher, wire contract and header box. Navigation owns the
  palette and keeps it usable when search is absent, with an explicit reason.
  Existing queries follow the scoped provider and resume through a fresh
  client after it returns; basic outline editing remains independent.

  @rows:vault,olai,chat,claude,git,ws,web-app,mcp,ui-renderer,layout,sidebar,preferences,theme,plugin-inspector,navigation,outlines,markdown,files,pins,capture,trash,vault-plugins
  Scenario: A serve that did not name search has no box, and its palette says why
    When I open the app
    Then the header has no search box
    When I press the palette shortcut
    And I type "cabinets" into the palette
    Then the search refuses "cabinets" and says "Search is unavailable right now."
    And there should be no page errors

  Scenario: Switching the row off takes the box out of the bar while you watch
    When I open the app
    And I search the header for "cabinets"
    Then the header search lists the node "order the new cabinets"
    When I open the plugins panel
    And I switch the plugin "search" off
    Then the header has no search box
    When I switch the plugin "search" on
    And I close the plugins panel
    And I search the header for "cabinets"
    Then the header search lists the node "order the new cabinets"
    And there should be no page errors

  Scenario: An open palette retracts results when search leaves and resumes when it returns
    When I open the app
    And I press the palette shortcut
    And I type "cabinets" into the palette
    Then the palette lists the node "order the new cabinets"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "search" off
    And I use the original browser tab
    Then the search refuses "cabinets" and says "Search is unavailable right now."
    When I use the other browser tab
    And I switch the plugin "search" on
    And I use the original browser tab
    Then the palette lists the node "order the new cabinets"
    And there should be no page errors

  Scenario: Removing search preserves an outline's active draft and its save path
    Given I open the outline "house.olai"
    And I mark the screen
    When I click the title of "handles"
    And I select all and type "outline without search"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "search" off
    And I use the original browser tab
    Then the node "handles" was never taken away
    When I click away from the editor
    Then "house.olai" holds a node titled "outline without search"
    And there should be no page errors
