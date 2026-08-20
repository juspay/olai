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
    # `null` is a real value for a note — "there is none" — and it has to
    # survive the round trip as one rather than collapsing into "no opinion".
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
    # A text undo puts back what THIS tab replaced, so it is only entitled to
    # overwrite what this tab wrote. When the row says something else, it is
    # refused in the ops layer's shape — never silently, and never on top of
    # them.
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

  Scenario: A mark the walk took off is put back by putting it on
    # The other shape, and the one that used to be wrong: two calls are for the
    # write that leaves a node DONE, and taking a mark off leaves a bullet. The
    # pair this answered with sent "take the mark off" at a row that no longer
    # had one, so the undo was refused a moment after it was pressed and dropped
    # with a reason nobody could act on.
    #
    # `knobs` rather than `hinges`, which this used to walk: `hinges` comes
    # after `order`, and `order` is still `doing`, so the walk's step onto
    # `doing` is now refused (`keyboard_editing.feature`). `knobs` is the same
    # `todo` with nothing in front of it, so the shape under test — a walk, and
    # the undo that puts back what it took off — is the one this scenario is
    # about rather than the order rule.
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
    # The gate has no back door. An undo is a WRITE — the inverse the server
    # recorded, replayed through the same `edit.apply` every key goes through
    # and judged against the set AS IT IS NOW — so a `doing` this tab took off
    # does not get put back just because it was there a moment ago.
    #
    # The world moves in between, which is the whole reason undo replays rather
    # than restores: `demo` is `done`, so `order` (which comes after it) is
    # free to be `doing`. Take that `done` off and walk `demo` to `todo`, and
    # `order` is now waiting on unfinished work.
    When I click the title of "demo"
    And I press "Control+Enter"
    Then the node "demo" has no status
    When I press "Control+Shift+Enter"
    Then the node "demo" has status "todo"
    # `order` was `doing` and is now drawn blocked. Walk the mark off it.
    #
    # THIS IS THE EDIT ⌘Z WILL TAKE BACK, and it is worth saying outright
    # because two writes to `demo` come first in this scenario: the stack
    # replays NEWEST first, so the two above are older entries and it is this
    # walk — the last thing this tab did — that sits on top.
    When I click away from the editor
    And I click the title of "order"
    And I press "Control+Shift+Enter"
    Then the node "order" has no status
    # ⌘Z asks for that `doing` back, and meets the refusal in the ops layer's
    # own words rather than writing a row the DAG forbids. The entry is dropped,
    # which is what a refused replay always is.
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the undo refusal says "`order the new cabinets` comes after 1 unfinished task, so it cannot start yet: `take out the old counters` (`demo`, todo). Finish that first — or start what is ready."
    And the node "order" has no status
    And the page has not reloaded
    And there should be no page errors

  Scenario: A two-call undo that meets the gate halfway stops there, and says why
    # The one undo shape that is a SEQUENCE — taking back the write that ticks a
    # node off — meeting the new gate. `order` is `doing`; put something
    # unfinished in front of it, then tick it off. Undoing that is the two calls
    # an agent makes: take the `done` off, then put the `doing` back. The first
    # lands and the second is refused, so `order` is left a bullet.
    #
    # That is the replay contract already documented for every inverse here
    # ("a refusal partway stops there"), not a hole opened by this rule: the
    # first call is a legal write on its own, nothing is lost, and the row is
    # one `Mark todo` away from where a blocked node should be. It is drawn
    # rather than swallowed, which is the whole of what is owed.
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
    # Enter writes it and opens the next line; Escape drops that one, which
    # leaves the caret nowhere — which is where ⌘Z is answered from.
    And I press "Enter"
    And I press "Escape"
    Then "house.olai" holds a node titled "a line typed by mistake"
    When I press "ControlOrMeta+z"
    # WAITED for, not held: the two steps read alike and mean opposite things.
    # "holds no node" is the promise that nothing was written and has to outlast
    # the commit window; this is a WRITE going through, and asking the holding
    # form of it passes only when the archive lands inside one animation frame.
    Then "house.olai" no longer holds a node titled "a line typed by mistake"
    And "_olai/Trash.olai" holds a node titled "a line typed by mistake"
    # NOTHING is said now, and that is the news. This used to be the one entry
    # that explained why it could not be redone — a `move` is same-file by the
    # format, so nothing this surface could send brought a row back out of the
    # archive. `unarchive` is that verb (`parity-unarchive`), so the write
    # simply lands and the chord below simply works.
    And nothing is said about the undo
    When I press "ControlOrMeta+Shift+z"
    Then "house.olai" holds a node titled "a line typed by mistake"
    # Waited for, and for the second reason the pair exists: an `unarchive` is
    # two files, and the record leaves the archive a moment after it arrives
    # here. Held, this reads the first of the two writes and calls the second
    # one a failure.
    And "_olai/Trash.olai" no longer holds a node titled "a line typed by mistake"
    # WHERE it landed, not just that it is back: the row was a sibling of
    # `handles`, so it belongs under `install`. With the chain above it still
    # standing, both roads lead there — the scenario below is the one that
    # tells the two apart.
    And "house.olai" holds a node titled "a line typed by mistake" under "install"

  Scenario: The redo puts the row back where it SAT, not where the titles now point
    # WHY the inverse of an archive carries a parent at all. It is an id the
    # server read off the snapshot the archive was judged against, and an id
    # outlives a retitle; the chain of ancestor TITLES the archive wrote down
    # does not. Retitle that parent while the row is in the Trash and the two
    # roads part: the chain names nothing any more, and the recorded parent
    # still names the row's own branch.
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
    # The whole reason this is an inverse and not a snapshot restore. Between
    # the move and the ⌘Z, another writer — a git pull, the agent, another tab —
    # puts a row in the file. Undoing the move must put the row back and leave
    # theirs exactly where it is.
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
    # The other half of the same claim. The inverse names a parent AND the
    # sibling the row sat after, and the pair is CHECKED: when that sibling has
    # itself gone somewhere else, "after it" and "under that parent" stop
    # agreeing, and the ops layer refuses rather than following the neighbour
    # into a branch this row was never in.
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
    # The judgment call, in the browser: nothing here invents a sentence for it.
    # A parent is same-file by the format, so the ops layer's own words about
    # the archive are exactly the right ones — and the entry is dropped.
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
    And another writer files a row under "a line somebody built on" in "house.olai"
    Then the node "interloper" is shown
    When I press "ControlOrMeta+z"
    Then the undo refusal says "under it now"
    And "house.olai" holds a node titled "a line somebody built on"
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
    And I open the outline "garden.olai"
    And I press "ControlOrMeta+z"
    Then the undo says "nothing to undo"
    And there should be no page errors

  Scenario: ...and a zoom into one of its own rows is not leaving it
    # The other half of the rule above, and the one that used to be broken: a
    # node of house.olai is house.olai, so zooming into it is the same outline
    # at a narrower address. The stack was cleared anyway — what "the open
    # file" was got asked of the PAGE, which blanks for one round trip on every
    # navigation, so a same-file zoom read as house.olai → nothing → house.olai
    # and the effect fired twice on the way through
    # (docs/brainstorming/reactivity-after-the-flip.md §3.1's 1.7).
    When I click the title of "knobs"
    And I press "Tab"
    And I click away from the editor
    Then the node "knobs" is a child of "hinges"
    # The zoomed page draws `install`’s children as its rows, so what the undo
    # puts back is read as `knobs` leaving `hinges` rather than as a nesting
    # under the heading.
    When I zoom into the node "install"
    And I press "ControlOrMeta+z"
    Then nothing is said about the undo
    And the node "knobs" is not a child of "hinges"
    And the page has not reloaded
    And there should be no page errors
