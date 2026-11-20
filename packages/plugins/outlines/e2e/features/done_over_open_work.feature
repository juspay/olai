@share-scratch
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

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I mark the page

  Scenario: ⌘Enter will not tick off a branch that still holds unfinished work
    When I click the title of "install"
    And I press "Control+Enter"
    Then the refusal says "`install the cabinets` holds 2 unfinished tasks, so it cannot be marked done yet"
    And the node "install" has no status
    And the page has not reloaded
    And there should be no page errors

  Scenario: The way through is the sentence's own, and then the branch ticks off
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

  Scenario: Work filed under a finished branch re-opens it instead of vanishing
    Given I open the outline "garden.olai"
    And I show the done nodes
    When I click the title of "frames"
    And I press "Control+Enter"
    Then the node "frames" has status "done"
    When I click the title of "slugs"
    And I press "Control+Shift+Enter"
    Then the node "slugs" has status "todo"
    And the node "frames" has no status
    And the nudge says "`the cold frames` was marked done over work that is not finished — done-hidden would have swept it off the page, so that mark is off now. Mark it done again when the branch really is finished."
    When I hide the done nodes
    Then the node "slugs" is shown
    And the node "glazing" is not shown
    And there should be no page errors

  Scenario: Finishing work under a finished branch changes nothing above it
    Given I open the outline "garden.olai"
    And I show the done nodes
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
    When I pick up the bullet of "knobs" and hold it one step in under the title of "demo"
    Then the drop line would put it under "demo"
    When I let go
    Then the node "knobs" is a child of "demo"
    And the node "demo" has no status
    And there should be no page errors
