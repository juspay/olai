@share-scratch
@scratch:good
Feature: Undo
  ⌘Z takes back the last edit YOU made here, and ⌘⇧Z puts it back.

  It is not a restore. Each structural key's inverse is recorded when the write
  lands — where the row sat, which mark it carried — and ⌘Z replays that inverse
  through the same write gate every other key goes through, judged against the
  outline AS IT IS NOW. So an undo never takes back anybody else's work, and one
  that no longer fits says why instead of guessing. `@scratch:` for the same
  reason keyboard editing is: these write the directory they are served.
  They share one copy per worker (`@share-scratch`); the corpus is restored
  between scenarios.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I mark the page

  Scenario: Tab, and ⌘Z puts the row back where it was
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "install"
    And the node "hinges" comes before "knobs"
    When I press "ControlOrMeta+Shift+z"
    Then the node "knobs" is a child of "hinges"
    And the page has not reloaded

  Scenario: Retyping a title is taken back like anything else
    When I click the title of "knobs"
    And I select all and type "pick the little brass knobs"
    And I press "Enter"
    And I press "Escape"
    Then the node "knobs" has the title "pick the little brass knobs"
    When I press "ControlOrMeta+z"
    Then the node "knobs" has the title "pick the knobs"
    And "house.olai" holds a node titled "pick the knobs"
    When I press "ControlOrMeta+Shift+z"
    Then the node "knobs" has the title "pick the little brass knobs"
    And the page has not reloaded

  Scenario: And so is a note
    When I open the note of "order"
    And I click the note of "order"
    Then the note of "order" is being typed
    When I type " — measured twice"
    And I click away from the editor
    Then "house.olai" holds a node whose note ends "— measured twice"
    When I press "ControlOrMeta+z"
    Then "house.olai" holds a node whose note ends "before ordering."
    When I press "ControlOrMeta+Shift+z"
    Then "house.olai" holds a node whose note ends "— measured twice"

  Scenario: Emptying a note is taken back too, and the note comes back
    When I open the note of "order"
    And I click the note of "order"
    Then the note of "order" is being typed
    When I select all and type ""
    And I click away from the editor
    Then "house.olai" holds a node with no note titled "order the new cabinets"
    When I press "ControlOrMeta+z"
    Then "house.olai" holds a node whose note ends "before ordering."
    When I press "ControlOrMeta+Shift+z"
    Then "house.olai" holds a node with no note titled "order the new cabinets"

  Scenario: An undo never writes over words somebody else typed
    When I click the title of "knobs"
    And I select all and type "pick the little brass knobs"
    And I press "Enter"
    And I press "Escape"
    Then the node "knobs" has the title "pick the little brass knobs"
    When another writer retitles "knobs" to "pick the chrome knobs" in "house.olai"
    Then the node "knobs" has the title "pick the chrome knobs"
    When I press "ControlOrMeta+z"
    Then the undo refusal says "has been retitled since"
    And the node "knobs" has the title "pick the chrome knobs"
    And "house.olai" holds a node titled "pick the chrome knobs"

  Scenario: Shift+Tab goes out, and ⌘Z puts it back in
    When I click the title of "knobs"
    And I press "Shift+Tab"
    Then the node "knobs" is a child of "kitchen"
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "install"
    And the node "hinges" comes before "knobs"
    When I press "ControlOrMeta+Shift+z"
    Then the node "knobs" is a child of "kitchen"

  Scenario: A reorder goes back the way it came
    When I click the title of "knobs"
    And I press "Alt+Shift+ArrowUp"
    Then the node "knobs" comes before "hinges"
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the node "hinges" comes before "knobs"

  Scenario: And so does one in the other direction
    When I click the title of "hinges"
    And I press "Alt+Shift+ArrowDown"
    Then the node "knobs" comes before "hinges"
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the node "hinges" comes before "knobs"
    When I press "ControlOrMeta+Shift+z"
    Then the node "knobs" comes before "hinges"

  Scenario: Ticking a task off puts back the mark it replaced
    When I click the title of "hinges"
    And I press "Control+Enter"
    Then the node "hinges" has status "done"
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the node "hinges" has status "todo"

  Scenario: A mark the walk took off is put back by putting it on
    When I click the title of "knobs"
    And I press "Control+Shift+Enter"
    Then the node "knobs" has status "doing"
    When I press "Control+Shift+Enter"
    Then the node "knobs" has no status
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the node "knobs" has status "doing"
    And nothing is said about the undo
    When I press "ControlOrMeta+Shift+z"
    Then the node "knobs" has no status

  Scenario: An undo that would re-enter doing on a now-blocked node is refused like anything else
    When I click the title of "demo"
    And I press "Control+Enter"
    Then the node "demo" has no status
    When I press "Control+Shift+Enter"
    Then the node "demo" has status "todo"
    When I click away from the editor
    And I click the title of "order"
    And I press "Control+Shift+Enter"
    Then the node "order" has no status
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the undo refusal says "`order the new cabinets` comes after 1 unfinished task, so it cannot start yet: `take out the old counters` (`demo`, todo). Finish that first — or start what is ready."
    And the node "order" has no status
    And the page has not reloaded
    And there should be no page errors

  Scenario: A two-call undo that meets the gate halfway stops there, and says why
    When I click the title of "demo"
    And I press "Control+Enter"
    And I press "Control+Shift+Enter"
    Then the node "demo" has status "todo"
    When I click away from the editor
    And I click the title of "order"
    And I press "Control+Enter"
    Then the node "order" has status "done"
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the undo refusal says "`order the new cabinets` comes after 1 unfinished task, so it cannot start yet: `take out the old counters` (`demo`, todo). Finish that first — or start what is ready."
    And the node "order" has no status
    And "house.olai" holds the node "order" with no mark

  Scenario: A new row is taken back into the Trash, and redo brings it out again
    When I click the title of "handles"
    And I press "Enter"
    And I type "a line typed by mistake"
    And I press "Enter"
    And I press "Escape"
    Then "house.olai" holds a node titled "a line typed by mistake"
    When I press "ControlOrMeta+z"
    Then "house.olai" no longer holds a node titled "a line typed by mistake"
    And "_olai/Trash.olai" holds a node titled "a line typed by mistake"
    And nothing is said about the undo
    When I press "ControlOrMeta+Shift+z"
    Then "house.olai" holds a node titled "a line typed by mistake"
    And "_olai/Trash.olai" no longer holds a node titled "a line typed by mistake"
    And "house.olai" holds a node titled "a line typed by mistake" under "install"

  Scenario: The redo puts the row back where it SAT, not where the titles now point
    When I click the title of "handles"
    And I press "Enter"
    And I type "a line typed by mistake"
    And I press "Enter"
    And I press "Escape"
    And I press "ControlOrMeta+z"
    Then "_olai/Trash.olai" holds a node titled "a line typed by mistake"
    When another writer retitles "install" to "fit the cabinets" in "house.olai"
    Then the node "install" has the title "fit the cabinets"
    When I press "ControlOrMeta+Shift+z"
    Then "house.olai" holds a node titled "a line typed by mistake" under "install"
    And "_olai/Trash.olai" no longer holds a node titled "a line typed by mistake"

  Scenario: An undo does not clobber what somebody else did meanwhile
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    When I click away from the editor
    And another writer adds "a row from somewhere else" to "house.olai"
    Then the node "outsider" is shown
    When I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "install"
    And the node "outsider" is shown
    And "house.olai" holds a node titled "a row from somewhere else"

  Scenario: An undo of a move somebody else has moved away from
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    When I click away from the editor
    And another writer lifts "hinges" to the top level of "house.olai"
    Then the node "hinges" is not a child of "install"
    When I press "ControlOrMeta+z"
    Then the undo refusal says "siblings"
    And the node "knobs" is a child of "hinges"

  Scenario: An undo whose old parent has been archived says where it went
    When I click the title of "knobs"
    And I press "Shift+Tab"
    Then the node "knobs" is a child of "kitchen"
    When I click away from the editor
    And another writer archives "install" out of "house.olai"
    Then the node "install" is not shown
    When I press "ControlOrMeta+z"
    Then the undo refusal says "_olai/Trash.olai"
    And the node "knobs" is a child of "kitchen"

  Scenario: An undo that no longer fits says why, and does not try again
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    When I click away from the editor
    And I click the title of "handles"
    And I press "Enter"
    And I type "a line somebody built on"
    And I press "Enter"
    And I press "Escape"
    And another writer files a row under "a line somebody built on" in "house.olai"
    Then the node "interloper" is shown
    When I press "ControlOrMeta+z"
    Then the undo refusal says "under it now"
    And "house.olai" holds a node titled "a line somebody built on"
    When I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "install"

  Scenario: A new op while an undo is still in flight wins the branch
    When I click the title of "hinges"
    And I press "Control+Enter"
    Then the node "hinges" has status "done"
    When I click away from the editor
    And I press "ControlOrMeta+z" without waiting
    And I click the title of "knobs"
    And I press "Tab" without waiting
    Then the node "knobs" is a child of "hinges"
    And the node "hinges" has status "todo"
    When I click away from the editor
    And I press "ControlOrMeta+Shift+z"
    Then the undo says "Nothing to redo"
    And the node "hinges" has status "todo"
    And the node "knobs" is a child of "hinges"

  Scenario: A new op takes away what the last undo said
    When I click the title of "knobs"
    And I press "Tab"
    And I click away from the editor
    And I press "ControlOrMeta+z"
    And I press "ControlOrMeta+z"
    Then the undo says "Nothing to undo"
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    And nothing is said about the undo

  Scenario: ⌘Z is dead while a draft is open
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    When I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "hinges"
    And nothing is said about the undo
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "install"

  Scenario: The chords are dead while the palette has the caret
    When I click the title of "knobs"
    And I press "Tab"
    And I click away from the editor
    And I press the palette shortcut
    Then the command palette is open
    When I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "hinges"
    And nothing is said about the undo

  Scenario: The stack belongs to the outline it was typed on
    When I click the title of "knobs"
    And I press "Tab"
    And I click away from the editor
    And I open the outline "garden.olai"
    And I press "ControlOrMeta+z"
    Then the undo says "Nothing to undo"
    And there should be no page errors

  Scenario: ...and a zoom into one of its own rows is not leaving it
    When I click the title of "knobs"
    And I press "Tab"
    And I click away from the editor
    Then the node "knobs" is a child of "hinges"
    When I zoom into the node "install"
    And I press "ControlOrMeta+z"
    Then nothing is said about the undo
    And the node "knobs" is not a child of "hinges"
    And the page has not reloaded
    And there should be no page errors
