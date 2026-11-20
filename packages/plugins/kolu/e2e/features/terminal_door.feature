Feature: The `terminal` property is a DOOR
  The human, 2026-08-25: "I keep checking the kolu Dock for terminal/agent
  status — reflect it in olai itself." The answer is to put the status where the
  fact already is. A lane step carries `terminal: <id>`, and that property is
  where the work IS — so the property draws the agent's own Dock row and
  opens onto the screen behind it, and no new page is needed for either.

  That is the whole of why these scenarios open an ORDINARY OUTLINE. There is no
  `/orchestrator` route yet and this phase does not add one: the door hangs off
  the property, so it lights up in the plain outline view the day it merges.

  Two rungs. The ROW is kolu's own Dock row, drawn where the property is and
  read off a fleet the tab already holds — one subscription per tab, one padi
  connection per server, whatever a page draws. olai invents no visual language
  for it: the same component paints the same fleet in both surfaces, so the two
  cannot come to disagree about it. The PANE is one screen read per press — a
  dashed border, a snapshot, a refetch button, and nothing subscribed.

  What olai still says for itself is why there is NO row: a terminal that is
  gone, a value naming three of them, an absent padi, a skew. None of those are
  things kolu's row has a face for, because from kolu's side they do not happen.
  Those sentences, and the promises the pane makes, are most of what the

  scenarios below are about.
  The padi behind them is this suite's own (`@padi:lanes`), serving padi's real
  surface over a real unix socket. A scenario that dialed a mock would prove
  nothing about the dial; a scenario that dialed the developer's actual kolu
  would prove something different on every machine.

  @scratch:lanes @padi:lanes
  Scenario: The row is kolu's own, on an ordinary outline
    Given I open the outline "lanes.olai"
    And I show the done nodes
    Then the terminal row on "door-implement" is working
    And the terminal row on "door-review" is awaiting
    And the terminal row on "door-review" is asking for you
    And the terminal row on "quiet-implement" is sleeping
    And the terminal on "door-implement" shows the stored value
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: The DECLARATION opens the door, and the key's name opens nothing
    Given I open the outline "lanes.olai"
    Then the terminal row on "named-implement" is working
    And "named-review" wears no terminal door at all
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A terminal the fleet no longer holds says so, and is not drawn as idle
    Given I open the outline "lanes.olai"
    And I show the done nodes
    Then the terminal on "old-implement" has no row
    And the terminal on "old-implement" says "This terminal was closed"
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: An enabled plugin declares its own key — nothing to edit, nothing written
    Given I open the outline "lanes.olai"
    Then the terminal row on "claimed-implement" is working
    And "claimed-mine" wears no terminal door at all
    And there should be no page errors

  @scratch:lanes @padi:lanes @rows:vault,olai,odu,ws,web-app,mcp,ui-renderer,layout,sidebar,preferences,theme,plugin-inspector,navigation,outlines,markdown,files,pins,capture,trash,vault-plugins
  Scenario: A serve that did not compose kolu is the machine that never had it
    Given I open the outline "lanes.olai"
    Then "door-implement" wears no terminal door at all
    And the padi indicator is not drawn at all
    And the connection is "live"
    And the terminal on "door-implement" shows no door but keeps its value
    And there should be no page errors

  @scratch:lanes
  Scenario: With no padi there are no rows and the page SAYS why, and is fine
    Given I open the outline "lanes.olai"
    Then the terminal on "door-implement" has no row
    And the terminal on "door-implement" says "kolu isn't running"
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: Pressing the row opens a LIVE window on the terminal
    Given I open the outline "lanes.olai"
    When I watch the terminal on "door-implement"
    Then a snapshot pane opens on "door-implement"
    And the pane is a live window rather than a snapshot
    And the live screen shows "just check"
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A second press closes the window, and closing drops the attach
    Given I open the outline "lanes.olai"
    When I watch the terminal on "door-review"
    Then a snapshot pane opens on "door-review"
    And the live screen shows "open the PR"
    When I watch the terminal on "door-review"
    Then no snapshot pane is open
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A terminal with no live screen says so, rather than sitting blank
    Given I open the outline "lanes.olai"
    And I show the done nodes
    When I watch the terminal on "quiet-implement"
    Then a snapshot pane opens on "quiet-implement"
    And the pane refuses with "may have closed"
    And there should be no page errors

  @scratch:lanes @padi:ahead
  Scenario: A padi this build cannot speak to is a SKEW, and says which two versions
    Given I open the outline "lanes.olai"
    Then the terminal on "door-implement" has no row
    And the terminal on "door-implement" says "99.0"
    And the terminal on "door-implement" says "Update one of them"
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A value naming a terminal by its EIGHT-CHARACTER PREFIX draws the live row
    Given I open the outline "lanes.olai"
    Then the terminal row on "door-implement" is working
    And the terminal row on "door-review" is awaiting
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: Pressing a PREFIX row reads the screen instead of breaking the page
    Given I open the outline "lanes.olai"
    When I watch the terminal on "door-implement"
    Then a snapshot pane opens on "door-implement"
    And the live screen shows "just check"
    When I watch the terminal on "door-implement"
    Then no snapshot pane is open
    And the terminal row on "door-review" is awaiting
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: The header says kolu is connected — one place, not one per chip
    Given I open the outline "lanes.olai"
    Then the padi indicator says "connected"
    And the health dot is "healthy"
    And there should be no page errors

  @scratch:lanes
  Scenario: The header says there is no kolu, and where it looked
    Given I open the outline "lanes.olai"
    Then the padi indicator says "absent"
    And the padi indicator explains "kolu isn't running"
    And the health dot is "healthy"
    And there should be no page errors

  @scratch:lanes @padi:ahead
  Scenario: The header says the two builds disagree, and names both versions
    Given I open the outline "lanes.olai"
    Then the padi indicator says "skew"
    And the padi indicator explains "99.0"
    And the padi indicator explains "Update one of them"
    And the health dot is "alarm"
    And the health dot names "kolu: update needed"
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A pane resized more than its whole budget is STILL LIVE
    Given I open the outline "lanes.olai"
    When I watch the terminal on "door-implement"
    Then a snapshot pane opens on "door-implement"
    And the live screen shows "just check"
    When I resize the window 8 times
    Then the pane on "door-implement" is still live
    And there should be no page errors
