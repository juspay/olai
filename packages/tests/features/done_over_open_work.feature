@scratch:good
Feature: A finished branch cannot hide unfinished work
  Hiding what is done drops a done row WITH its subtree — deliberately, because
  a mark on a parent is somebody's claim about the whole branch. So a `done`
  standing over a `todo` is work that has vanished from the view whose whole
  job is showing what is left, and on 2026-08-16 that is exactly what happened
  to this repo's own roadmap: a root marked done in August froze there, five
  days of new children accumulated under it, and four freshly-filed items were
  swept off the page by a sentence nobody had reread.

  The human's ruling: a preventable constraint, not a nudge — and both doors
  onto the state are gated, because the incident walked through the second one.
  Marking a branch done over open tasks is REFUSED, naming them. Open work
  ARRIVING under a done ancestor takes that ancestor's mark off instead, and
  says so: a person writing work down must not be told no because of a mark
  they cannot see from where they are standing.

  Both gates are the ops layer's, written once, so the keyboard here, the •••
  menu (menu_verbs.feature), the ⌘K palette and an agent all meet the same
  sentence. What this feature drives is the two faces a person sees.

  `@scratch:` because these write the directory they are served — each
  scenario gets a private copy of it.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  # ── the claim: refused ─────────────────────────────────────────────

  Scenario: ⌘Enter will not tick off a branch that still holds unfinished work
    # `install the cabinets` is a bullet with two `todo` children under it.
    # `choose the handles` is a bullet too — not a task, so not in the way.
    When I click the title of "install"
    And I press "Control+Enter"
    Then the refusal says "`install the cabinets` holds 2 unfinished tasks, so it cannot be marked done yet: `pick the hinges` (`hinges`, todo), `pick the knobs` (`knobs`, todo). Done-hidden hides a done node WITH its subtree, so this would sweep them off the page. Finish those first — or take the mark off them if they are not happening, since an unmarked bullet is not unfinished work."
    And the node "install" has no status
    And the page has not reloaded
    And there should be no page errors

  Scenario: The way through is the sentence's own, and then the branch ticks off
    # Both halves of the refusal's advice, in one scenario: one task finished,
    # the other's mark walked off. What is left under the row is bullets and
    # done work, which is a branch anybody may call finished.
    When I click the title of "hinges"
    And I press "Control+Enter"
    Then the node "hinges" has status "done"
    When I click the title of "knobs"
    And I press "Control+Shift+Enter"
    And I press "Control+Shift+Enter"
    Then the node "knobs" has no status
    When I click the title of "install"
    And I press "Control+Enter"
    Then the node "install" has status "done"
    And there should be no page errors

  Scenario: A mirror is a second view, not a second obligation
    # `the herb bed by the door` has `split the mint` under it, so the branch is
    # unfinished wherever you stand — the refusal is the same at a placement,
    # because a mark is a fact about the node a row SHOWS. What the mirror does
    # NOT do is make the branch it SITS in unfinished: `kitchen remodel` holds
    # this placement of open work and is refused for its own children, not for
    # what a second view of somewhere else draws.
    When I click the title of "kitchen-herbs"
    And I press "Control+Enter"
    Then the refusal says "`the herb bed by the door` holds 1 unfinished task"
    # The row goes on drawing what its target says, which is `doing` and not a
    # thing this key was allowed to change.
    And the node "kitchen-herbs" has status "doing"
    And there should be no page errors

  # ── the arrival: the branch re-opens ───────────────────────────────

  Scenario: Work filed under a finished branch re-opens it instead of vanishing
    # THE INCIDENT, end to end. `the cold frames` is a bullet whose two tasks
    # are both done, so it is a branch anybody may tick off — and the moment
    # something under it becomes work again, the claim it makes is false.
    Given I open the outline "garden.olai"
    When I click the title of "frames"
    And I press "Control+Enter"
    Then the node "frames" has status "done"
    When I click the title of "slugs"
    And I press "Control+Shift+Enter"
    Then the node "slugs" has status "todo"
    # Not refused, and not quiet: the checkbox above empties in front of you and
    # the line under the row says which mark came off and why.
    And the node "frames" has no status
    And the nudge says "`the cold frames` was marked done over work that is not finished — done-hidden would have swept it off the page, so that mark is off now. Mark it done again when the branch really is finished."
    # And the proof that this was worth doing: with finished work hidden, the
    # row that was just filed is still on the page. Under the old rule the whole
    # branch went with the stale mark, and this is the row that would have gone.
    When I hide the done nodes
    Then the node "slugs" is shown
    And the node "glazing" is not shown
    And there should be no page errors

  Scenario: Finishing work under a finished branch changes nothing above it
    # The other direction of the same write: `done` arriving under `done` is not
    # unfinished work, so there is nothing to re-open and the branch stays shut.
    Given I open the outline "garden.olai"
    When I click the title of "frames"
    And I press "Control+Enter"
    Then the node "frames" has status "done"
    When I click the title of "slugs"
    And I press "Control+Enter"
    Then the node "slugs" has status "done"
    And the node "frames" has status "done"
    And nothing is being said about the row
    And there should be no page errors

  Scenario: A row dragged under a finished branch re-opens it too
    # The same gate, reached by the mouse and through a different op — the
    # arrival is a MOVE. `take out the old counters` is done and empty; `pick
    # the knobs` is `todo`, and dropping it in there is the incident again with
    # nobody touching a mark at all.
    When I pick up the bullet of "knobs" and hold it one step in under the title of "demo"
    Then the drop line would put it under "demo"
    When I let go
    Then the node "knobs" is a child of "demo"
    And the node "demo" has no status
    And there should be no page errors
