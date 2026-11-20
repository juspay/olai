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
    Given I open the outline "house.olai"
    And I show the done nodes
    And I mark the page

  Scenario: ⌥Enter calls a row off, and says so three ways
    When I click the title of "knobs"
    And I press "Alt+Enter"
    Then the node "knobs" has status "cancelled"
    And the node "knobs" shows a crossed checkbox
    And "house.olai" holds a node marked cancelled titled "pick the knobs"
    When I press "Escape"
    Then the title of "knobs" is struck through
    And the page has not reloaded
    And there should be no page errors

  Scenario: The same key takes it back
    When I click the title of "knobs"
    And I press "Alt+Enter"
    Then the node "knobs" has status "cancelled"
    When I press "Alt+Enter"
    Then the node "knobs" has no status
    When I press "Escape"
    Then the title of "knobs" is not struck through
    And there should be no page errors

  Scenario: The ••• menu writes it too, under Mark
    When I open the node menu of "knobs"
    And I choose "Mark › Cancelled" from the node menu
    Then the node "knobs" has status "cancelled"
    And the node "knobs" shows a crossed checkbox
    And there should be no page errors

  Scenario: The walk will not take it back on its own
    When I click the title of "knobs"
    And I press "Alt+Enter"
    Then the node "knobs" has status "cancelled"
    When I press "Control+Shift+Enter"
    Then the refusal says "`pick the knobs` is cancelled. Undo that first"
    And the node "knobs" has status "cancelled"
    And there should be no page errors

  Scenario: Anything after a cancelled target stops waiting
    Given the node "hinges" is blocked by "order"
    When I click the title of "order"
    And I press "Alt+Enter"
    Then the node "order" has status "cancelled"
    And the node "hinges" is not blocked
    And there should be no page errors

  Scenario: A parent goes done over a cancelled child
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
    When I click the title of "install"
    And I press "Alt+Enter"
    Then the node "install" has status "cancelled"
    And the nudge says "`install the cabinets` is cancelled, but 2 tasks under it are still unfinished and still owed"
    And the node "hinges" has status "todo"
    And the node "knobs" has status "todo"
    And there should be no page errors

  Scenario: A cancelled row is on today's journal page, struck through
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
