@share-scratch
@scratch:good
Feature: Native task timing — `started`, `took`, and the ticking row

  Every mark on a row is a fact the record stores; until this, only the two
  SETTLING instants were. Starting went by unrecorded, so nothing could say
  how long the work took — the orchestrator's lane timings had to be
  subtracted from the neighbours' settling instants, and a human vault's
  chores timed nothing at all.

  `started` is a field beside the marks, stamped by `set_doing` on EVERY
  start, and `worked` is the bank beside it: every settle adds the round
  it closed (whole seconds, on the record), so a re-open stamps a FRESH
  instant and the pause between two rounds is never counted. `took` stays
  derived, never stored twice — the bank once settled, with no fallback
  to `created` for a jump that stored no start and closed no round. And
  it is DRAWN, in two registers: a doing row ticks bank plus live round
  off the wire-carried instant (the uptime chip's seam), a settled row
  wears the quiet chip, always visible — on both a REAL span and the time
  sunk into work that got called off, and on NOTHING that never had a
  round.

  Scenarios are written against the shared `good` vault and restore it
  between them; `handles` and `knobs` are two leaves with nothing in their
  way. (A row the scenario is walking is in its editor — the chip is for
  the row as it STANDS, so each reading below first steps away from it.)

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  # ── the running span ───────────────────────────────────────────────

  Scenario: A row set doing ticks live from its stored start
    When I click the title of "handles"
    And I press "Control+Shift+Enter"
    And I press "Control+Shift+Enter"
    Then the node "handles" has status "doing"
    And "house.olai" holds a node marked doing titled "choose the handles"
    When I click away from the editor
    # The clock reads SECOND: from one frame to the next, without another
    # write from anybody, the chip must not sit still.
    Then the node "handles" is ticking
    And there should be no page errors

  Scenario: Settling closes the span, and the row wears it
    When I click the title of "handles"
    And I press "Control+Shift+Enter"
    And I press "Control+Shift+Enter"
    Then the node "handles" has status "doing"
    When I press "Control+Enter"
    Then the node "handles" has status "done"
    When I click away from the editor
    # The tick is done: the chip is the settled reading, seconds derived off
    # the two stamps — not a freeze frame of whatever the counter last said.
    Then the node "handles" shows a settled took chip
    # And the journal reads it: the same row on today's page, the same chip.
    When I open today
    Then the node "handles" shows a settled took chip
    And there should be no page errors

  # `knobs` stands at `todo` in the fixture: ONE ⌘⇧Enter walks it to doing
  # (the walk is the three-state clean → todo → doing → clean).
  Scenario: Calling it off wears the time sunk, not the shame of it
    When I click the title of "knobs"
    And I press "Control+Shift+Enter"
    Then the node "knobs" has status "doing"
    When I press "Alt+Enter"
    Then the node "knobs" has status "cancelled"
    When I click away from the editor
    # A mark where a walk landed is never *true*, and the span the wait took
    # is worth keeping on the row.
    Then the node "knobs" shows a settled took chip
    And "house.olai" holds a node marked cancelled titled "pick the knobs"
    And there should be no page errors

  # ── the silences ───────────────────────────────────────────────────

  Scenario: The jump carries nothing
    # Straight to done, never through doing: no `started` was ever stamped,
    # so there is no span to tell — and falling back to `created` would be
    # the chip measuring the node's age and calling it work.
    When I click the title of "knobs"
    And I press "Control+Enter"
    Then the node "knobs" has status "done"
    When I click away from the editor
    Then the node "knobs" shows no took chip
    # And work settled before spans existed says nothing either: `demo` has
    # a `done` and no `started`, and no chip — the ordinary shape of an old
    # vault, not an error case.
    And the node "demo" shows no took chip
    # Bullets carry nothing, however interesting their day gets.
    And the node "install" shows no took chip
    And there should be no page errors

  # A title that COLLIDES with the chip's words: a title is a string, and
  # "⏱ 2h 34m" is somebody's chore — the renderer must read it as the
  # string it is, not as the chip's markup echoing into a second fixture.
  Scenario: The chip's own words are a title like any other
    When I click the title of "handles"
    And I select all and type "⏱ 2h 34m"
    And I press "Enter"
    Then the node "handles" has the title "⏱ 2h 34m"
    And "house.olai" holds a node titled "⏱ 2h 34m"
    When I click away from the editor
    # Nothing echoes: the row carries no chip, and the words stayed a title.
    Then the node "handles" shows no took chip
    And there should be no page errors

  Scenario: A re-open banks the round and stamps a fresh start
    When I click the title of "handles"
    And I press "Control+Shift+Enter"
    And I press "Control+Shift+Enter"
    Then the node "handles" has status "doing"
    When I click away from the editor
    # The instant is on the row now; the fresh start below is measured
    # against it. (The chip's own attr — nothing a planner could pass
    # would reach it: the chip reads the wire, the wire reads the record.)
    Then the node "handles" wears a start
    # Back into the walk: settle, undo — and a PAUSE, two whole seconds of
    # it. Stamps are seconds-precise, so the gap the rule exists to exclude
    # has to be wider than one of them before it can be told from none.
    When I click the title of "handles"
    And I press "Control+Enter"
    And I press "Control+Enter"
    And I let 2 seconds go by
    When I press "Control+Shift+Enter"
    And I press "Control+Shift+Enter"
    Then the node "handles" has status "doing"
    When I click away from the editor
    Then the node "handles" is ticking
    # `todo → doing → done → undone → (pause) → doing`: the first round is
    # BANKED on the record, and the instant the chip wears is the FRESH
    # round's — the pause between the two belongs to nobody.
    And the node "handles" wears a fresh start, not that one
    And "house.olai" holds a node titled "choose the handles" with the rounds banked
    And there should be no page errors
