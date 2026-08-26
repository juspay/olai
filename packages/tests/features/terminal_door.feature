Feature: The `terminal` property is a DOOR
  The human, 2026-08-25: "I keep checking the kolu Dock for terminal/agent
  status — reflect it in olai itself." The answer is to put the status where the
  fact already is. A lane step carries `terminal: <id>`, and that property is
  where the work IS — so the chip that draws it wears the agent's state and
  opens onto the screen behind it, and no new page is needed for either.

  That is the whole of why these scenarios open an ORDINARY OUTLINE. There is no
  `/orchestrator` route yet and this phase does not add one: the door hangs off
  the property, so it lights up in the plain outline view the day it merges.

  Two rungs. The DOT is a reading of a fleet the tab already holds — one
  subscription per tab, one padi connection per server, whatever a page draws.
  The PANE is one screen read per click: a dashed border, a snapshot, a refetch
  button, and nothing subscribed. What separates them is what they promise, and
  the scenarios below are mostly about promises being kept — that a hollow dot
  never reads as a quiet one, that a click costs exactly one read, and that
  closing forgets.

  The padi behind them is this suite's own (`@padi:lanes`), serving padi's real
  surface over a real unix socket. A scenario that dialed a mock would prove
  nothing about the dial; a scenario that dialed the developer's actual kolu
  would prove something different on every machine.

  @scratch:lanes @padi:lanes
  Scenario: The dot wears the agent's bucket, on an ordinary outline
    # Three lanes, three states, one page — and the reader never went anywhere
    # special to see them.
    Given I open the outline "lanes.olai"
    Then the terminal chip on "door-implement" wears the working face
    And the terminal chip on "door-review" wears the awaiting face
    And the terminal chip on "quiet-implement" wears the parked face
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A terminal the fleet no longer holds says so, and is not drawn as idle
    # The property is still a true record of where the work happened. A gray
    # dot would claim the terminal is sitting there doing nothing, which is a
    # different and wrong fact.
    Given I open the outline "lanes.olai"
    Then the terminal chip on "old-implement" is hollow
    And the terminal chip on "old-implement" says "no longer in the fleet"
    And there should be no page errors

  @scratch:lanes
  Scenario: With no padi the chips go hollow and SAY so, and the page is fine
    # No `@padi:` tag, so this server derives the rendezvous path and finds
    # nothing — a laptop that is not running kolu, which is most of them. The
    # vault opens, every row draws, and the chips are honest about what they
    # cannot see. This is the scenario that would catch a hollow drawn as a
    # quiet gray dot, which is the one confusion the whole design refuses.
    Given I open the outline "lanes.olai"
    Then the terminal chip on "door-implement" is hollow
    And the terminal chip on "door-implement" says "no padi is running"
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: Clicking the dot grows a snapshot pane, and refetch is the only thing that moves it
    # Rung 2. The pane says SNAPSHOT three ways — the dashed border, the age
    # line, and the button — because the promise it is making is that nothing
    # here is live.
    Given I open the outline "lanes.olai"
    When I click the terminal dot on "door-implement"
    Then a snapshot pane opens on "door-implement"
    And the snapshot pane shows "just check"
    And the snapshot pane is a snapshot rather than a live view
    When I refetch the snapshot
    Then the snapshot pane shows "just check"
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A second click closes the pane, and closing forgets what it read
    # The snapshot promise kept on the way out as well as in: a pane reopened
    # later must not show an old screen under a fresh "just now".
    Given I open the outline "lanes.olai"
    When I click the terminal dot on "door-review"
    Then a snapshot pane opens on "door-review"
    And the snapshot pane shows "open the PR"
    When I click the terminal dot on "door-review"
    Then no snapshot pane is open
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A terminal with no live screen refuses in words, in the pane
    # `t-parked` is asleep: padi has no live mirror to read, which is its own
    # `TerminalNotFound` and the expected answer for a lane that finished. It
    # is a sentence in the pane, not a fault and not an empty box.
    Given I open the outline "lanes.olai"
    When I click the terminal dot on "quiet-implement"
    Then a snapshot pane opens on "quiet-implement"
    And the snapshot pane refuses with "no live screen"
    And there should be no page errors

  @scratch:lanes @padi:ahead
  Scenario: A padi this build cannot speak to is a SKEW, and says which two versions
    # The other half of the hollow. "Start kolu" and "these two builds
    # disagree" have opposite fixes, which is why the link cell has three
    # states rather than a boolean — and a skew reported as absent would tell a
    # reader to start a kolu that is already running.
    #
    # The control core answers even here: its schemas never move, so the
    # refusal is a judgement on a readable hello rather than a decode failure
    # three calls later.
    Given I open the outline "lanes.olai"
    Then the terminal chip on "door-implement" is hollow
    And the terminal chip on "door-implement" says "99.0"
    And the terminal chip on "door-implement" says "upgrade"
    And there should be no page errors
