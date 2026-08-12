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

  Scenario: Retyping a title is taken back like anything else
    # The hole the human found by driving it (2026-08-12): a title committed
    # and then ⌘Z'd used to answer "nothing to undo". A DRAFT is the editor's —
    # Escape and blur own it, and the chord is dead while one is open — but the
    # op a committed draft produced is an op like any other, and the title it
    # replaced is a perfect inverse.
    When I click the title of "knobs"
    And I select all and type "pick the little brass knobs"
    # Enter commits it and opens the next line; Escape drops that one, which is
    # what takes the caret out of a row.
    And I press "Enter"
    And I press "Escape"
    Then the node "knobs" has the title "pick the little brass knobs"
    When I press "ControlOrMeta+z"
    Then the node "knobs" has the title "pick the knobs"
    And "house.jsonl" holds a node titled "pick the knobs"
    When I press "ControlOrMeta+Shift+z"
    Then the node "knobs" has the title "pick the little brass knobs"
    And the page has not reloaded

  Scenario: And so is a note
    When I click the note of "order"
    And I click the note of "order"
    Then the note of "order" is being typed
    When I type " — measured twice"
    And I click away from the editor
    Then "house.jsonl" holds a node whose note ends "— measured twice"
    When I press "ControlOrMeta+z"
    Then "house.jsonl" holds a node whose note ends "before ordering."
    When I press "ControlOrMeta+Shift+z"
    Then "house.jsonl" holds a node whose note ends "— measured twice"

  Scenario: Emptying a note is taken back too, and the note comes back
    # `null` is a real value for a note — "there is none" — and it has to
    # survive the round trip as one rather than collapsing into "no opinion".
    When I click the note of "order"
    And I click the note of "order"
    Then the note of "order" is being typed
    When I select all and type ""
    And I click away from the editor
    Then "house.jsonl" holds a node with no note titled "order the new cabinets"
    When I press "ControlOrMeta+z"
    Then "house.jsonl" holds a node whose note ends "before ordering."
    When I press "ControlOrMeta+Shift+z"
    Then "house.jsonl" holds a node with no note titled "order the new cabinets"

  Scenario: Typing through a mirror is taken back on the node it stands for
    # A mirror has no text of its own, so what a person types there lands on the
    # node it SHOWS — and so does taking it back. The write and its inverse both
    # name the target, in the file the target lives in.
    When I click the title of "kitchen-herbs"
    And I select all and type "the herb bed by the back door"
    And I press "Enter"
    And I press "Escape"
    Then "garden.jsonl" holds a node titled "the herb bed by the back door"
    When I press "ControlOrMeta+z"
    Then "garden.jsonl" holds a node titled "the herb bed by the door"
    And "house.jsonl" holds no node titled "the herb bed by the door"

  Scenario: An undo never writes over words somebody else typed
    # A text undo puts back what THIS tab replaced, so it is only entitled to
    # overwrite what this tab wrote. When the row says something else, it is
    # refused in the ops layer's shape — never silently, and never on top of
    # them.
    When I click the title of "knobs"
    And I select all and type "pick the little brass knobs"
    And I press "Enter"
    And I press "Escape"
    Then the node "knobs" has the title "pick the little brass knobs"
    When another writer retitles "knobs" to "pick the chrome knobs" in "house.jsonl"
    Then the node "knobs" has the title "pick the chrome knobs"
    When I press "ControlOrMeta+z"
    Then the undo refusal says "has been retitled since"
    And the node "knobs" has the title "pick the chrome knobs"
    And "house.jsonl" holds a node titled "pick the chrome knobs"

  Scenario: Shift+Tab goes out, and ⌘Z puts it back in
    # The other direction, and not the same arithmetic: an outdent lands a row
    # after what used to be its parent, so the place it left is a parent AND a
    # neighbour rather than "one level in".
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

  Scenario: An undo of a move somebody else has moved away from
    # The other half of the same claim. The inverse names a parent AND the
    # sibling the row sat after, and the pair is CHECKED: when that sibling has
    # itself gone somewhere else, "after it" and "under that parent" stop
    # agreeing, and the ops layer refuses rather than following the neighbour
    # into a branch this row was never in.
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    When I click away from the editor
    And another writer lifts "hinges" to the top level of "house.jsonl"
    Then the node "hinges" is not a child of "install"
    When I press "ControlOrMeta+z"
    Then the undo refusal says "siblings"
    And the node "knobs" is a child of "hinges"

  Scenario: An undo whose old parent has been archived says where it went
    # The judgment call, in the browser: nothing here invents a sentence for it.
    # A parent is same-file by the format, so the ops layer's own words about
    # the archive are exactly the right ones — and the entry is dropped.
    When I click the title of "knobs"
    And I press "Shift+Tab"
    Then the node "knobs" is a child of "kitchen"
    When I click away from the editor
    And another writer archives "install" out of "house.jsonl"
    Then the node "install" is not shown
    When I press "ControlOrMeta+z"
    Then the undo refusal says "Archive.jsonl"
    And the node "knobs" is a child of "kitchen"

  Scenario: An undo that no longer fits says why, and does not try again
    # The refusal a person is owed. A row somebody has filed work under is not
    # an undo's to take back — so the entry is dropped, the reason is on screen,
    # and pressing ⌘Z again reaches the edit BEFORE it: the indent, which is
    # still on the stack under the entry that would not go.
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    When I click away from the editor
    And I click the title of "handles"
    And I press "Enter"
    And I type "a line somebody built on"
    And I press "Enter"
    And I press "Escape"
    And another writer files a row under "a line somebody built on" in "house.jsonl"
    Then the node "interloper" is shown
    When I press "ControlOrMeta+z"
    Then the undo refusal says "under it now"
    And "house.jsonl" holds a node titled "a line somebody built on"
    # Dropped, not retried — and what was under it is still there.
    When I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "install"

  Scenario: A new op while an undo is still in flight wins the branch
    # The stack's rule under concurrency: a new op clears what redo would have
    # put back, and an undo finishing afterwards must not resurrect it. Both
    # keys are pressed WITHOUT WAITING, and the undo here is the longest one
    # this editor can make — `hinges` is `todo`, so taking the tick back is two
    # ops — which is the widest window the next key can land in.
    #
    # It is the RULE this scenario holds, end to end, rather than the race:
    # ⌘Z needs the caret out of a row and `Tab` needs it in one, so the click
    # between them is time enough for a local write to finish, and a browser
    # cannot promise the two overlap. What the interleaving itself is held by
    # is `web/src/client/edit/undoing.test.ts`, which hands the stack a write
    # it can hold open and records a new op in the middle of it — red before
    # every stack mutation went through one queue, green after.
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
    # Redo is dead: the indent branched away from it. If the replay had filed
    # its entry after the indent cleared the side, this would tick `hinges`
    # back to done.
    Then the undo says "nothing to redo"
    And the node "hinges" has status "todo"
    And the node "knobs" is a child of "hinges"

  Scenario: A new op takes away what the last undo said
    When I click the title of "knobs"
    And I press "Tab"
    And I click away from the editor
    And I press "ControlOrMeta+z"
    And I press "ControlOrMeta+z"
    Then the undo says "nothing to undo"
    # The sentence was about an undo that is now two edits ago; a person who
    # has carried on working is not still being told about it.
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    And nothing is said about the undo

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

  Scenario: The chords are dead while the palette has the caret
    # The other half of "dead in a form": the palette's own input is a text
    # field like any other, so the chord that opens it is the only one it
    # answers. Same rule that keeps the chat composer's typing its own.
    When I click the title of "knobs"
    And I press "Tab"
    And I click away from the editor
    And I press the palette shortcut
    Then the command palette is open
    When I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "hinges"
    And nothing is said about the undo

  Scenario: The stack belongs to the outline it was typed on
    # Its entries name rows in one file, so opening another is where it ends.
    When I click the title of "knobs"
    And I press "Tab"
    And I click away from the editor
    And I open the outline "garden.jsonl"
    And I press "ControlOrMeta+z"
    Then the undo says "nothing to undo"
    And there should be no page errors
