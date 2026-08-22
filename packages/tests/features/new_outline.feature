@share-scratch
@scratch:good
Feature: Starting a new outline from the sidebar
  An agent could mint an outline — `create_outline` — and a person could not:
  the sidebar listed every file in the directory and offered no way to start
  another. A standing consistency violation rather than a missing feature
  (HACKING.md: "MCP and Web ops must be consistent; never deviate"), and this
  is the door that closes it, beside the one documents already had.

  What is typed is the PATH, because a file's name is its address in this app
  — the sidebar, the URL and every reading of the set call it by it. The suffix
  is the door's own half of that: this door makes outlines, so `Foo` is asked
  for as `Foo.olai` and `Foo.olai` is asked for as itself. Nothing else about
  the path is judged in the browser — it goes to the ops layer completed and
  otherwise as it was typed, and what comes back for one it will not take is
  `create_outline`'s own sentence, drawn verbatim under the box.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: A new outline is created and opened, and the sidebar lists it
    When I create the outline "plans/next.olai" from the sidebar
    Then the address is "/plans/next.olai"
    And the outline list links to "plans/next.olai"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The first row of it is written where the page offers one
    # No seed on the wire, deliberately: an agent's `create_outline` may be born
    # holding a tree, and a person types the first line where it will live —
    # which the empty outline's own page is already the affordance for.
    When I create the outline "plans/next.olai" from the sidebar
    And I start the first line
    And I type "buy the tickets"
    And I click away from the editor
    Then "plans/next.olai" holds a node titled "buy the tickets"
    And there should be no page errors

  Scenario: A path the set already holds is refused in the op's own words
    When I create the outline "house.olai" from the sidebar
    Then the outline creation is refused saying "is already an outline"
    And the address is "/house.olai"

  Scenario: A bare name is the file the door makes, and is opened
    # The bug this feature grew for: `Foo` came back as the wire's paragraph
    # about relative `.olai` paths, for a name with nothing wrong with it
    # except the four characters the door already knows.
    When I create the outline "Foo" from the sidebar
    Then the address is "/Foo.olai"
    And the outline list links to "Foo.olai"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The folders in a bare path are kept, and only the suffix is added
    When I create the outline "notes/plan" from the sidebar
    Then the address is "/notes/plan.olai"
    And the outline list links to "notes/plan.olai"
    And there should be no page errors

  Scenario: A path that climbs out of the directory is still the planner's
    # The three rules the PLANNER holds are one sentence and still its own — a
    # browser that pre-checked any of them would be a second rule free to
    # disagree with the one an agent meets. What it names is the COMPLETED
    # path, which is the file that was actually asked for.
    When I create the outline "../escape.olai" from the sidebar
    Then the outline creation is refused saying "is not a relative `.olai` path"
    When I create the outline "../escape" from the sidebar
    Then the outline creation is refused saying "`../escape.olai` is not a relative"

  Scenario: A name carrying the other kind's suffix is the box's own refusal
    # The one verdict this side makes for itself, because it is about WHICH
    # DOOR you are at — a question the ops layer never sees, since what reaches
    # it is one completed path. Short words, and it says what to type instead.
    When I create the outline "notes.md" from the sidebar
    Then the outline creation is refused saying "`notes.md` is a document, not an outline — type `notes` to make `notes.olai`."
    And the address is "/house.olai"

  Scenario: Escape puts the box away and writes nothing
    When I open the new outline box
    And I fill the new outline box with "plans/next.olai"
    And I press "Escape"
    Then the new outline box is gone
    And the outline list does not link to "plans/next.olai"
