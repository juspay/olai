@share-scratch
@scratch:good
Feature: The fourth mark — "not happening" is a stored fact
  There were three marks, and "this is not happening" was said by taking one
  OFF. What that leaves is a bullet: a line indistinguishable from one nobody
  ever called work, carrying no mark, no instant and no day. A month later the
  vault could not tell you that anything had been decided, let alone when.

  So `cancelled` is a mark (the human, 2026-08-25), and it SETTLES: nobody is
  waiting on a node carrying it. That is one property shared with `done` and it
  is the only one — the row is struck through like a finished one and told
  apart by its box, which is a cross rather than a check.

  Two rulings, and both are driven here rather than described:

    1. cancelled SETTLES — a parent's Complete is not refused over a cancelled
       child, and anything `after` a cancelled target unblocks;
    2. it records the INSTANT and shows on that day's journal page, struck
       through.

  `@scratch:` because these write the directory they are served. They share one
  copy per worker (`@share-scratch`); the corpus is restored between scenarios.

  Background:
    Given I open the outline "house.org"
    # These scenarios tick rows off and keep reading them, so finished work
    # must stay drawn: the per-page default is hidden now (preferences.feature).
    And I show the done nodes
    And I mark the page

  # ── the mark itself ────────────────────────────────────────────────

  Scenario: ⌥Enter calls a row off, and says so three ways
    # The keyboard's third mark key — `Enter` with the third modifier, the
    # family `Ctrl+Enter` and `Ctrl+Shift+Enter` already belong to.
    When I click the title of "knobs"
    And I press "Alt+Enter"
    Then the node "knobs" has status "cancelled"
    # The BOX is where the two settling marks are told apart…
    And the node "knobs" shows a crossed checkbox
    # And it is on disk, under the mark's own name.
    And "house.org" holds a node marked cancelled titled "pick the knobs"
    # …and the STRIKE is what they share: nobody is waiting on this line. Read
    # off the title the page draws, so the caret is put away first — a row
    # being typed in has an input where its title is.
    When I press "Escape"
    Then the title of "knobs" is struck through
    And the page has not reloaded
    And there should be no page errors

  Scenario: The same key takes it back
    # A toggle, exactly as ⌘Enter is — the server reads the direction off the
    # mark the node actually carries. And what an undo leaves is a BULLET
    # rather than the mark that was displaced: taking a mark off is one op, and
    # it is the same thing ⌘Enter does to a finished row.
    When I click the title of "knobs"
    And I press "Alt+Enter"
    Then the node "knobs" has status "cancelled"
    When I press "Alt+Enter"
    Then the node "knobs" has no status
    When I press "Escape"
    Then the title of "knobs" is not struck through
    And there should be no page errors

  Scenario: The ••• menu writes it too, in the mouse's own word
    When I open the node menu of "knobs"
    And I choose "Cancel" from the node menu
    Then the node "knobs" has status "cancelled"
    And the node "knobs" shows a crossed checkbox
    And there should be no page errors

  Scenario: The walk will not take it back on its own
    # Neither settling mark is a stop on the ring, and the refusal is the ops
    # layer's own sentence — the same one an agent meets, naming the way out.
    When I click the title of "knobs"
    And I press "Alt+Enter"
    Then the node "knobs" has status "cancelled"
    When I press "Control+Shift+Enter"
    Then the refusal says "`pick the knobs` is cancelled. Undo that first"
    And the node "knobs" has status "cancelled"
    And there should be no page errors

  # ── ruling one: it settles ─────────────────────────────────────────

  Scenario: Anything after a cancelled target stops waiting
    # `pick the hinges` comes after `order the new cabinets`, which is `doing`
    # — so the row is drawn waiting. Calling the target off clears the way:
    # nobody can finish work somebody has decided against, so a mark that went
    # on blocking would be an obstacle with no way past it.
    Given the node "hinges" is blocked by "order"
    When I click the title of "order"
    And I press "Alt+Enter"
    Then the node "order" has status "cancelled"
    And the node "hinges" is not blocked
    And there should be no page errors

  Scenario: A parent goes done over a cancelled child
    # THE REFUSAL'S OWN ADVICE, made sayable. `install the cabinets` holds two
    # `todo` children, so Complete is refused naming them — and the way past is
    # to settle what is not happening. Before the fourth mark that meant
    # clearing the marks and leaving bullets; now it is a mark, an instant and
    # a day.
    When I click the title of "install"
    And I press "Control+Enter"
    Then the refusal says "`install the cabinets` holds 2 unfinished tasks"
    And the refusal says "or cancel them if they are not happening"
    When I press "Escape"
    And I click the title of "hinges"
    And I press "Alt+Enter"
    Then the node "hinges" has status "cancelled"
    When I click the title of "knobs"
    And I press "Alt+Enter"
    Then the node "knobs" has status "cancelled"
    When I click the title of "install"
    And I press "Control+Enter"
    Then the node "install" has status "done"
    And there should be no page errors

  Scenario: Cancelling a branch refuses nothing, and names what it left standing
    # The other half of ruling one, and the answer to "should this be gated
    # like Complete": it is not. Complete is refused over open work because
    # done-hiding sweeps the row WITH its subtree; nothing hides a cancelled
    # row, so there is nothing for a refusal to protect. What the write says
    # instead is what is still owed under it.
    When I click the title of "install"
    And I press "Alt+Enter"
    Then the node "install" has status "cancelled"
    And the nudge says "`install the cabinets` is cancelled, but 2 tasks under it are still unfinished and still owed"
    # Nothing was swept: the rows under it are still on the page, still marked.
    And the node "hinges" has status "todo"
    And the node "knobs" has status "todo"
    And there should be no page errors

  # ── ruling two: the instant, and the day ───────────────────────────

  Scenario: A cancelled row is on today's journal page, struck through
    # Nothing in this fixture is dated today, so `/today` is empty until this
    # write — which is what makes the row that appears unambiguous. The date
    # badge names WHICH of the node's dates put it there, and the word it
    # prints is the mark's own.
    When I click the title of "knobs"
    And I press "Alt+Enter"
    Then the node "knobs" has status "cancelled"
    When I press "Escape"
    And I open today
    Then the node "knobs" is shown
    And the node "knobs" is on the day for its "cancelled"
    And the node "knobs" shows a crossed checkbox
    And the title of "knobs" is struck through
    And there should be no page errors
