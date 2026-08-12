@scratch:good
Feature: Undo
  ⌘Z takes back the last edit YOU made here, and ⌘⇧Z puts it back.

  It is not a restore. Each structural key's inverse is recorded when the write
  lands — where the row sat, which mark it carried — and ⌘Z replays that inverse
  through the same write gate every other key goes through, judged against the
  outline AS IT IS NOW. So an undo never takes back anybody else's work, and one
  that no longer fits says why instead of guessing. `@scratch:` for the same
  reason keyboard editing is: these write the directory they are served.

  Background:
    Given I open the outline "house.jsonl"
    And I mark the page

  Scenario: Tab, and ⌘Z puts the row back where it was
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    # The draft first: ⌘Z is dead while one is open, because an input has the
    # platform's own undo in it and Escape owns abandoning.
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "install"
    And the node "hinges" comes before "knobs"
    When I press "ControlOrMeta+Shift+z"
    Then the node "knobs" is a child of "hinges"
    And the page has not reloaded

  Scenario: A reorder goes back the way it came
    When I click the title of "knobs"
    And I press "Alt+Shift+ArrowUp"
    Then the node "knobs" comes before "hinges"
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the node "hinges" comes before "knobs"

  Scenario: Ticking a task off puts back the mark it replaced
    # `hinges` is `todo`, and the format allows at most one mark — so ticking it
    # off did not add `done` beside the `todo`, it REPLACED it. Undo puts the
    # `todo` back, which the ops layer needs two calls for (it refuses any other
    # mark over a node that is done): exactly the two an agent would make.
    When I click the title of "hinges"
    And I press "Control+Enter"
    Then the node "hinges" has status "done"
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the node "hinges" has status "todo"

  Scenario: A new row is taken back into the archive
    When I click the title of "handles"
    And I press "Enter"
    And I type "a line typed by mistake"
    # Enter writes it and opens the next line; Escape drops that one, which
    # leaves the caret nowhere — which is where ⌘Z is answered from.
    And I press "Enter"
    And I press "Escape"
    Then "house.jsonl" holds a node titled "a line typed by mistake"
    When I press "ControlOrMeta+z"
    Then "house.jsonl" holds no node titled "a line typed by mistake"
    And "Archive.jsonl" holds a node titled "a line typed by mistake"
    # Said rather than left as a ⌘⇧Z that does nothing: a `move` is same-file by
    # the format, so nothing this surface can send brings it back out.
    And the undo says "archive"

  Scenario: An undo does not clobber what somebody else did meanwhile
    # The whole reason this is an inverse and not a snapshot restore. Between
    # the move and the ⌘Z, another writer — a git pull, the agent, another tab —
    # puts a row in the file. Undoing the move must put the row back and leave
    # theirs exactly where it is.
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    When I click away from the editor
    And another writer adds "a row from somewhere else" to "house.jsonl"
    Then the node "outsider" is shown
    When I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "install"
    And the node "outsider" is shown
    And "house.jsonl" holds a node titled "a row from somewhere else"

  Scenario: An undo that no longer fits says why, and does not try again
    # The refusal a person is owed. A row somebody has filed work under is not
    # an undo's to take back — so the entry is dropped, the reason is on screen,
    # and pressing ⌘Z again reaches the edit BEFORE it rather than this one.
    When I click the title of "handles"
    And I press "Enter"
    And I type "a line somebody built on"
    And I press "Enter"
    And I press "Escape"
    And another writer files a row under "a line somebody built on" in "house.jsonl"
    Then the node "interloper" is shown
    When I press "ControlOrMeta+z"
    Then the undo refusal says "under it now"
    And "house.jsonl" holds a node titled "a line somebody built on"
    # Dropped, not retried: the next ⌘Z is about the edit before it — the title
    # of `handles`, which is a text edit and not on the stack at all, so what is
    # left is nothing.
    When I press "ControlOrMeta+z"
    Then the undo says "nothing to undo"

  Scenario: ⌘Z is dead while a draft is open
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    # The caret is still in the row. ⌘Z here is the input's own undo — what it
    # must not be is the outline's.
    When I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "hinges"
    And nothing is said about the undo
    # And the stack is still there once the caret leaves.
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "install"

  Scenario: The stack belongs to the outline it was typed on
    # Its entries name rows in one file, so opening another is where it ends.
    When I click the title of "knobs"
    And I press "Tab"
    And I click away from the editor
    And I open the outline "garden.jsonl"
    And I press "ControlOrMeta+z"
    Then the undo says "nothing to undo"
    And there should be no page errors
