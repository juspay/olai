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
    # Three lanes, three states, one page — and the reader never went anywhere
    # special to see them.
    Given I open the outline "lanes.olai"
    Then the terminal row on "door-implement" is working
    And the terminal row on "door-review" is awaiting
    And the terminal row on "door-review" is asking for you
    And the terminal row on "quiet-implement" is sleeping
    And the terminal on "door-implement" shows the stored value
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A terminal the fleet no longer holds says so, and is not drawn as idle
    # The property is still a true record of where the work happened. A gray
    # live row would claim the terminal is sitting there doing nothing, which is a
    # different and wrong fact.
    Given I open the outline "lanes.olai"
    Then the terminal on "old-implement" has no row
    And the terminal on "old-implement" says "no longer in the fleet"
    And there should be no page errors

  @scratch:lanes
  Scenario: With no padi there are no rows and the page SAYS why, and is fine
    # No `@padi:` tag, so this server derives the rendezvous path and finds
    # nothing — a laptop that is not running kolu, which is most of them. The
    # vault opens, every row draws, and the chips are honest about what they
    # cannot see. This is the scenario that would catch "nothing to report" drawn
    # as "we looked and it is quiet", which is the one confusion the design refuses.
    Given I open the outline "lanes.olai"
    Then the terminal on "door-implement" has no row
    And the terminal on "door-implement" says "no padi is running"
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: Pressing the row opens a LIVE window on the terminal
    # Rung 2, and it is a window rather than a photograph: the pane says LIVE
    # two ways — the solid border and the tag — because the promise it makes is
    # that what is in the box is what is in the terminal, now.
    #
    # THE BROWSER DOES NOT DIAL PADI to do it. What this page subscribes to is
    # an ordinary member of olai's own surface; the server holds padi's attach
    # on the one connection the fleet already rides.
    Given I open the outline "lanes.olai"
    When I watch the terminal on "door-implement"
    Then a snapshot pane opens on "door-implement"
    And the pane is a live window rather than a snapshot
    And the live screen shows "just check"
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A second press closes the window, and closing drops the attach
    # The restraint kept on the way out as well as in. Closing UNMOUNTS the
    # terminal, so there is no attach behind a pane nobody is looking at —
    # twelve lanes on a page are twelve rows and zero attached terminals until
    # somebody presses one.
    Given I open the outline "lanes.olai"
    When I watch the terminal on "door-review"
    Then a snapshot pane opens on "door-review"
    And the live screen shows "open the PR"
    When I watch the terminal on "door-review"
    Then no snapshot pane is open
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A terminal with no live screen says so, rather than sitting blank
    # A sleeping terminal has no live mirror to serialize, so padi refuses the
    # attach at once and the pane says so at once.
    #
    # A sentence IN PLACE OF the terminal — not a fault, not an empty box, and
    # not a frozen screen under a tag still claiming to be live.
    Given I open the outline "lanes.olai"
    When I watch the terminal on "quiet-implement"
    Then a snapshot pane opens on "quiet-implement"
    And the pane refuses with "it may have closed"
    And there should be no page errors

  @scratch:lanes @padi:ahead
  Scenario: A padi this build cannot speak to is a SKEW, and says which two versions
    # The other half of the silence. "Start kolu" and "these two builds
    # disagree" have opposite fixes, which is why the link cell has three
    # states rather than a boolean — and a skew reported as absent would tell a
    # reader to start a kolu that is already running.
    #
    # The control core answers even here: its schemas never move, so the
    # refusal is a judgement on a readable hello rather than a decode failure
    # three calls later.
    Given I open the outline "lanes.olai"
    Then the terminal on "door-implement" has no row
    And the terminal on "door-implement" says "99.0"
    And the terminal on "door-implement" says "upgrade"
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A value naming a terminal by its EIGHT-CHARACTER PREFIX draws the live row
    # THE PRODUCTION DEFECT, and the shape the board actually writes: seventy-
    # eight of the vault's bare `terminal` values are an eight-character
    # prefix and nine are whole uuids. padi keys its fleet by the uuid, so an
    # exact lookup answered nothing for the ordinary case — a working terminal
    # drawn as retired, on the human's own board.
    #
    # `door-implement` names its terminal by prefix, `door-review` by the whole
    # id, and both must light.
    Given I open the outline "lanes.olai"
    Then the terminal row on "door-implement" is working
    And the terminal row on "door-review" is awaiting
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: Pressing a PREFIX row reads the screen instead of breaking the page
    # THE SECOND HALF of the same defect, and the worse half: the chip sent the
    # prefix, padi's `screen.text` declares its id a uuid, and the schema
    # refusal went down the wire as a DEFECT — which threw during render and
    # took the whole page with it ("This page broke", nothing updates again).
    #
    # So this scenario is as much about the page as about the pane: the read
    # lands, AND the page is still alive afterwards, which is what the last two
    # steps are for.
    Given I open the outline "lanes.olai"
    When I watch the terminal on "door-implement"
    Then a snapshot pane opens on "door-implement"
    And the live screen shows "just check"
    # ...and the page still works: a row still answers, and nothing was thrown.
    When I watch the terminal on "door-implement"
    Then no snapshot pane is open
    And the terminal row on "door-review" is awaiting
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: The header says kolu is connected — one place, not one per chip
    # A per-property sentence cannot tell "this terminal is gone" from "there is no
    # fleet", and a page with no `terminal` property anywhere says nothing at
    # all. So the link gets a chrome readout beside the connection pill.
    Given I open the outline "lanes.olai"
    Then the padi indicator says "connected"
    And there should be no page errors

  @scratch:lanes
  Scenario: The header says there is no kolu, and where it looked
    # No `@padi:` tag, so this server dials the rendezvous path and finds
    # nothing — a laptop that is not running kolu, which is most of them.
    Given I open the outline "lanes.olai"
    Then the padi indicator says "absent"
    And the padi indicator explains "no padi is answering"
    And there should be no page errors

  @scratch:lanes @padi:ahead
  Scenario: The header says the two builds disagree, and names both versions
    # The loud face, and the one nothing else on the page will ever say: two
    # builds that cannot speak to each other is a fact somebody has to act on,
    # and the sentence names both versions so the reader knows which way to
    # move.
    Given I open the outline "lanes.olai"
    Then the padi indicator says "skew"
    And the padi indicator explains "99.0"
    And the padi indicator explains "needs an upgrade"
    And there should be no page errors
