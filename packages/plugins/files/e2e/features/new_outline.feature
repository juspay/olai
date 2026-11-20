@share-scratch
@scratch:good
Feature: Starting a new outline from the sidebar
  An agent could mint an outline — `files_create` — and a person could not:
  the sidebar listed every file in the directory and offered no way to start
  another. A standing consistency violation rather than a missing feature
  ("MCP and Web ops must be consistent; never deviate"), and this
  is the door that closes it, beside the one documents already had.

  What is typed is the PATH, because a file's name is its address in this app
  — the sidebar, the URL and every reading of the set call it by it. The suffix
  is the door's own half of that: this door makes outlines, so `Foo` is asked
  for as `Foo.olai` and `Foo.olai` is asked for as itself. Nothing else about
  the path is judged in the browser — it goes to the ops layer completed and
  otherwise as it was typed, and what comes back for one it will not take is
  `files_create`'s own sentence, drawn verbatim under the box.

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
    When I create the outline "../escape.olai" from the sidebar
    Then the outline creation is refused saying "is not a relative file path"
    When I create the outline "../escape" from the sidebar
    Then the outline creation is refused saying "`../escape.olai` is not a relative"

  Scenario: A path that names a PLACE reaches the planner as it was typed
    When I create the outline ".." from the sidebar
    Then the outline creation is refused saying "`..` is not a relative file path"
    When I create the outline "." from the sidebar
    Then the outline creation is refused saying "`.` is not a relative file path"
    When I create the outline "notes/" from the sidebar
    Then the outline creation is refused saying "`notes/` is not a relative file path"
    And the outline list does not link to "...olai"

  Scenario: A name carrying the other kind's suffix is the box's own refusal
    When I create the outline "notes.md" from the sidebar
    Then the outline creation is refused saying "`notes.md` is a document, not an outline — type `notes` to make `notes.olai`."
    And the new outline box still holds "notes.md"
    And the address is "/house.olai"

  Scenario: Escape puts the box away and writes nothing
    When I open the new outline box
    And I fill the new outline box with "plans/next.olai"
    And I press "Escape"
    Then the new outline box is gone
    And the outline list does not link to "plans/next.olai"

  Scenario: Dots in a name are kept when the box adds its outline suffix
    When I create the outline "notes.v2" from the sidebar
    Then the address is "/notes.v2.olai"
    And the outline list links to "notes.v2.olai"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The Outlines + offers the two kinds of file, and Escape hands focus back
    When I open the Outlines + menu from the keyboard
    Then the Outlines + menu offers "New outline|New document"
    When I press "Escape"
    Then the Outlines + menu is shut and the + has focus
    And the outline list does not link to "plans/next.olai"
    And there should be no page errors

  Scenario: New outline from the + menu, by keyboard, opens its path box with the caret in it
    When I open the Outlines + menu from the keyboard
    And I choose "New outline" from the Outlines + menu with the keyboard
    Then the new outline box has the caret
    When I type "plans/keyed"
    And I press "Enter"
    Then the address is "/plans/keyed.olai"
    And the outline list links to "plans/keyed.olai"
    And there should be no page errors

  Scenario: New document from the + menu opens the document's path box
    When I open the Outlines + menu
    And I choose "New document" from the Outlines + menu with the keyboard
    Then the new document box has the caret
    And the new outline box is gone
    And there should be no page errors

  @phone
  Scenario: On a phone the name box asks for a Done key, and Done is what the key does
    # The gesture is made straight after the assertion, so the cap and
    # the key cannot drift apart.
    When I open the new outline box
    Then the new outline box asks for a Done key and no corrections
    When I create the outline "plans/next.olai" from the sidebar
    Then the address is "/plans/next.olai"
    And the new outline box is gone
    And the outline list links to "plans/next.olai"
    And there should be no page errors
