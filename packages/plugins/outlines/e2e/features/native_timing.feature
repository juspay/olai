@share-scratch
@scratch:good
Feature: Native task timing — `started`, `took`, and the ticking row

  Every mark on a row is a fact the record stores; until this, only the two
  SETTLING instants were. Starting went by unrecorded, so nothing could say
  how long the work took — the orchestrator's lane timings had to be
  subtracted from the neighbours' settling instants, and a human vault's
  chores timed nothing at all.

  `started` is a field beside the marks, stamped by `outlines_doing` on EVERY
  start, and `worked` is the bank beside it: a round banks where its
  `doing` comes off — settled, queued back to todo, or un-started (whole
  seconds, on the record) — so a re-open stamps a FRESH
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
    And I show the done nodes
    And I mark the page

  Scenario: A row set doing ticks live from its stored start
    When I click the title of "handles"
    And I press "Control+Shift+Enter"
    And I press "Control+Shift+Enter"
    Then the node "handles" has status "doing"
    And "house.olai" holds a node marked doing titled "choose the handles"
    When I click away from the editor
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
    Then the node "handles" shows a settled took chip
    When I open today
    Then the node "handles" shows a settled took chip
    And there should be no page errors

  Scenario: Calling it off wears the time sunk, not the shame of it
    When I click the title of "knobs"
    And I press "Control+Shift+Enter"
    Then the node "knobs" has status "doing"
    When I press "Alt+Enter"
    Then the node "knobs" has status "cancelled"
    When I click away from the editor
    Then the node "knobs" shows a settled took chip
    And "house.olai" holds a node marked cancelled titled "pick the knobs"
    And there should be no page errors

  Scenario: The jump carries nothing
    When I click the title of "knobs"
    And I press "Control+Enter"
    Then the node "knobs" has status "done"
    When I click away from the editor
    Then the node "knobs" shows no took chip
    And the node "demo" shows no took chip
    And the node "install" shows no took chip
    And there should be no page errors

  Scenario: The chip's own words are a title like any other
    When I click the title of "handles"
    And I select all and type "⏱ 2h 34m"
    And I press "Enter"
    Then the node "handles" has the title "⏱ 2h 34m"
    And "house.olai" holds a node titled "⏱ 2h 34m"
    When I click away from the editor
    Then the node "handles" shows no took chip
    And there should be no page errors

  Scenario: A re-open banks the round and stamps a fresh start
    When I click the title of "handles"
    And I press "Control+Shift+Enter"
    And I press "Control+Shift+Enter"
    Then the node "handles" has status "doing"
    When I click away from the editor
    Then the node "handles" wears a start
    When I click the title of "handles"
    And I press "Control+Enter"
    And I press "Control+Enter"
    And I let 2 seconds go by
    When I press "Control+Shift+Enter"
    And I press "Control+Shift+Enter"
    Then the node "handles" has status "doing"
    When I click away from the editor
    Then the node "handles" is ticking
    And the node "handles" wears a fresh start, not that one
    And "house.olai" holds a node titled "choose the handles" with the rounds banked
    And there should be no page errors
