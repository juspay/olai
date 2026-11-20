Feature: A plugin is turned on and off while the serve runs
  A press writes on to the settings file and follows the reconciled roster.
  The vault provider and configuration reader are session-only exceptions.
  Other rows use a session switch while the reader is unavailable.

  THE REACTIVE HALF IS WHAT MAKES IT ONE VERB rather than a restart, and these
  two scenarios are where that is benched rather than argued. A plugin is a
  fiber; every registration it made is a finalizer on its own scope; so turning
  a row off unwinds its kinds, its wake, its sibling surface and any door it
  stood behind — and revoking a door unloads every fiber that named it. Turning
  it back on re-applies all of them.

  THE TWO ROWS ARE CHOSEN FOR WHAT THEY REACH. Kolu contributes a property KIND
  and a sibling surface, so its flip is visible in the vault's own reading: the
  door on a `terminal` value is drawn because a kind judges that value, and a
  kind that has left takes the door with it. Chat OFFERS four services, so its
  flip is the only one in this build that moves other rows — the engines and
  both tenants name one of its doors, and go `waiting` on the tag while it is
  away.

  Both scenarios press the switch and then read the page, never a reload: what
  the roster moving is FOR is that every open tab redials and rebuilds itself
  around the answer.

  @scratch:lanes @padi:lanes
  Scenario: Kolu's kind leaves with its fiber
    Given I open the outline "lanes.olai"
    And I show the done nodes
    Then the terminal row on "door-implement" is working
    And the appliance link reads connected

    When I open the plugins panel
    Then the plugins panel says nothing more about "kolu"
    And the plugin "kolu" is running

    When I switch the plugin "kolu" off
    Then "door-implement" wears no terminal door at all
    And the plugin "kolu" is off without prose
    And there should be no page errors
    And no member of this page has gone silent

  @scratch:lanes @padi:lanes
  Scenario: A row that comes back is served again
    Given I open the outline "lanes.olai"
    And I show the done nodes
    Then the terminal row on "door-implement" is working
    And the appliance link reads connected

    When I open the plugins panel
    And I switch the plugin "kolu" off
    Then "door-implement" wears no terminal door at all

    When I switch the plugin "kolu" on
    Then the appliance link reads connected
    And the terminal row on "door-implement" is working
    And no member of this page has gone silent
    And there should be no page errors

  @scratch:lanes @rows:vault,olai,kolu,odu,ws,web-app,mcp,ui-renderer,layout,sidebar,preferences,theme,plugin-inspector,navigation,outlines,markdown,files,pins,capture,trash,vault-plugins
  Scenario: A file-disabled row is switched on while the reader is absent
    Given I open the outline "lanes.olai"
    Then chat controls are gone-from the outline
    When I open the plugins panel
    Then the plugins panel says "kolu" is "Can't start: another plugin it needs isn't running (deliveries, session-start)."
    And the plugin "chat" is off without prose

    When I switch the plugin "settings" off
    And I switch the plugin "chat" on
    Then the plugins panel says nothing more about "kolu"
    And every plugin enable switch has a session-only ring
    And the agents roster holds 9 agents
    And the agent start pill on "lane-fresh" is absent
    And no member of this page has gone silent
    And there should be no page errors

  @scratch:lanes
  Scenario: Turning the chat row off takes every row that named its doors
    Given I open the outline "lanes.olai"
    Then chat controls are in the outline
    When I open the plugins panel
    And I request that the plugin "chat" be off
    Then the plugins panel asks to confirm turning "chat" off
    And the confirm for "chat" names "Kolu"

    When I confirm turning the plugin "chat" off
    Then the plugins panel says "kolu" is "Can't start: another plugin it needs isn't running (deliveries, session-start)."
    And chat controls are gone-from the outline
    And the outline list is shown
    And there should be no page errors

    When I switch the plugin "chat" on
    Then the plugins panel says nothing more about "kolu"
    And the plugins panel says nothing more about "chat"
    And chat controls are in the outline
    And there should be no page errors

  @scratch:good
  Scenario: A group starts collapsed, and a press on its heading opens it
    When I open the app
    And I open the plugins panel
    Then the plugins panel group "Notes" is collapsed
    And the plugins panel group "Interface" is collapsed
    When I open the plugins panel group "Notes"
    Then the plugins panel groups "outlines" under "Notes"
    And the plugins panel group "Interface" is collapsed
    When I switch the plugin "outlines" off
    And I switch the plugin "outlines" on
    Then the plugins panel groups "outlines" under "Notes"
    And the plugins panel group "Interface" is collapsed
