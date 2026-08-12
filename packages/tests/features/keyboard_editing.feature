@scratch:good
Feature: Keyboard editing
  The Workflowy loop, without the agent: click a title and type, Enter for the
  next line, Tab and Shift+Tab for the shape, Alt+Shift+arrows to reorder,
  Ctrl+Enter to tick something off, Shift+Enter for the note.

  Every one of those is one op through the same write gate the agent's tools go
  through, and nothing is echoed: what you see is the file coming back. Which
  is why these are `@scratch:` — they write the directory they are served, so
  each gets a private copy of it (`support/hooks.ts`).

  Background:
    Given I open the outline "house.jsonl"
    And I mark the page

  Scenario: Typing a title writes it, and the page follows the file
    When I click the title of "handles"
    And I select all and type "choose the brass handles"
    And I press "Enter"
    Then the node "handles" has the title "choose the brass handles"
    And "house.jsonl" holds a node titled "choose the brass handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A draft is an editor until something commits it
    # The no-optimistic-UI rule from the other side: what is typed is nowhere
    # near the disk until one of the three moments — and then it is. Both
    # halves, because either one alone is half the promise: a client that never
    # wrote would pass the first, and one that wrote per keystroke the second.
    When I click the title of "knobs"
    And I select all and type "pick the little brass knobs"
    Then "house.jsonl" holds no node titled "pick the little brass knobs"
    And "house.jsonl" holds a node titled "pick the knobs"
    # Idle is the third moment (blur and Enter are the other two, and have
    # scenarios of their own): stop typing, and it goes. The editor stays open
    # — a commit is not a reason to take the caret away — so the row is asked
    # of the page only after the caret leaves it.
    Then "house.jsonl" holds a node titled "pick the little brass knobs"
    When I press "Escape"
    Then the node "knobs" has the title "pick the little brass knobs"

  Scenario: Escape abandons what was typed
    When I click the title of "knobs"
    And I select all and type "something else entirely"
    And I press "Escape"
    Then no row is being edited
    And the node "knobs" has the title "pick the knobs"

  Scenario: Blur commits the draft
    When I click the title of "knobs"
    And I select all and type "pick the little brass knobs"
    And I click away from the editor
    Then the node "knobs" has the title "pick the little brass knobs"
    And no row is being edited

  Scenario: Enter opens the next row, and it is written when it has a title
    When I click the title of "handles"
    And I press "Enter"
    Then a new row is being typed
    # Still nothing on disk: an empty new row is not a node, which is why
    # `Enter` opens an editor rather than writing a blank record.
    And the outline "house.jsonl" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"
    When I type "measure the alcove"
    And I press "Enter"
    Then "house.jsonl" holds a node titled "measure the alcove"
    And the page has not reloaded

  Scenario: The line being typed sits where the row will sit
    # A new sibling is drawn at the depth it will HAVE, not one step out of it:
    # the draft reserves the same gutter a row does (the `•••` cell and the
    # collapse triangle), so the line a person types is the line they get.
    When I click the title of "hinges"
    And I press "Enter"
    Then a new row is being typed
    And the row being typed lines up with the title of "hinges"

  Scenario: The row holding the caret says so
    # Walking with the arrows moved a blinking cursor and nothing else, which
    # in a tree of a hundred rows is a pixel nobody finds.
    When I click the title of "handles"
    Then the row "handles" holds the caret
    And no other row holds the caret
    When I press "ArrowDown"
    Then the row "hinges" holds the caret
    And no other row holds the caret

  Scenario: An abandoned empty row writes nothing
    When I click the title of "handles"
    And I press "Enter"
    And I press "Escape"
    Then no row is being edited
    And the outline "house.jsonl" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"

  Scenario: Tab indents under the row above, and Shift+Tab puts it back
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    When I press "Shift+Tab"
    Then the node "knobs" is a child of "install"
    And the page has not reloaded

  Scenario: The first of its siblings has nothing to indent under
    When I click the title of "handles"
    And I press "Tab"
    Then the refusal says "no row above it"
    And the node "handles" is a child of "install"
    # And the row goes on working: a refused key writes nothing and changes
    # nothing about the editor it was pressed in.
    When I select all and type "choose the brass handles"
    And I click away from the editor
    Then "house.jsonl" holds a node titled "choose the brass handles"

  Scenario: Alt+Shift+Up moves a row among its siblings
    When I click the title of "knobs"
    And I press "Alt+Shift+ArrowUp"
    Then the node "knobs" comes before "hinges"
    And the page has not reloaded

  Scenario: Ctrl+Enter ticks a row off, and again takes it back
    When I click the title of "handles"
    And I press "Control+Enter"
    Then the node "handles" has status "done"
    When I press "Control+Enter"
    Then the node "handles" has no status

  Scenario: The keys keep working after the row has moved
    # The caret is what a structural op nearly costs: the row is redrawn where
    # the file says it now is, which in a browser takes the focus off it.
    When I click the title of "knobs"
    And I press "Tab"
    And I press "Shift+Tab"
    And I press "Alt+Shift+ArrowUp"
    And I press "Control+Enter"
    Then the node "knobs" has status "done"
    And the row being typed holds "pick the knobs"

  Scenario: Clicking the note you are reading puts the caret in it
    # The human's call over the textarea this shipped with, mapped onto olai's
    # clamp: the clamped line expands (as it has since notes-single, and that
    # expanded note is where a row draws its rendering and its see links), and
    # a click in the note you are now reading puts the caret in it — one click
    # from what Workflowy would have been showing all along. What you see while
    # you are in it is the markdown SOURCE, the same trade the title takes.
    When I click the note of "order"
    Then the description of "order" renders bold text "walnut"
    When I click the note of "order"
    Then the note of "order" is being typed
    And the note being typed holds the source of "order"
    When I type " — measured twice"
    And I click away from the editor
    Then "house.jsonl" holds a node whose note ends "— measured twice"
    # And clicking away is what it always was: the note folds back to its one
    # clamped line, now with what was typed in it. Editing and expanding are
    # ONE state — you leave both at once — and the full rendered note is the
    # node's own page, which is where a note has always been the body.
    And the description of "order" is a preview of "Two ways to go:"

  Scenario: Shift+Enter writes the note, and the rendering comes back
    When I click the title of "handles"
    And I press "Shift+Enter"
    Then the note of "handles" is being typed
    When I type "the alcove is **1830mm** wide"
    And I press "Shift+Enter"
    Then the note of "handles" is no longer being typed
    # `Shift+Enter` writes a note without expanding the row's reading of it, so
    # what comes back is the clamped line — the shape it had before the caret
    # arrived, now with something in it.
    And the description of "handles" is a preview of "the alcove is 1830mm wide"
    And "house.jsonl" holds a node whose note ends "wide"

  Scenario: A write that lands can have something to say
    # The ops layer's nudge — advice on a SUCCESS, never a refusal. It reaches
    # an agent in its tool result; the person who pressed the key is exactly
    # who it is for, so it reaches them too.
    # `mint` is the last unfinished task under `herbs` — which is the moment
    # somebody might want to tick the parent too, and now can.
    Given I open the outline "garden.jsonl"
    When I click the title of "mint"
    And I press "Control+Enter"
    Then the node "mint" has status "done"
    And the nudge says "every task under"
    # And it is advice, not a state: the next keystroke takes it away.
    When I type "!"
    Then nothing is being said about the row

  Scenario: A refused write keeps the draft and says why
    When I click the title of "handles"
    And I select all and type ""
    And I click away from the editor
    Then the refusal says "a node needs a title"
    And the row being typed holds ""
    And "house.jsonl" holds a node titled "choose the handles"

  Scenario: A refusal belongs to the row that caused it
    # Two rows and one refusal: clicking away to another title commits the
    # first, and a commit that is REFUSED stops there — the reason is on the
    # row whose text is still unsaved, and the row that was clicked is not
    # opened over the top of it. Before the write queue, the click opened the
    # second row and the refusal landed on it.
    When I click the title of "handles"
    And I select all and type ""
    And I click the title of "knobs"
    Then the refusal says "a node needs a title"
    And the row being typed holds ""
    And "house.jsonl" holds a node titled "pick the knobs"

  Scenario: Two refusals in a row leave the editor working
    # The blur guard is cleared by a refused key as well as by a frame, so a
    # second refusal cannot latch it — after which the row still commits.
    When I click the title of "handles"
    And I press "Tab"
    Then the refusal says "no row above it"
    When I press "Tab"
    Then the refusal says "no row above it"
    When I select all and type "choose the brass handles"
    And I click away from the editor
    Then "house.jsonl" holds a node titled "choose the brass handles"

  Scenario: The keys keep up with a person typing faster than the wire
    # Every write goes through one queue, so keys pressed without waiting land
    # in the order they were pressed — and each is judged against what the one
    # before it did, rather than against the row as it was two writes ago.
    When I click the title of "knobs"
    And I press "Tab" without waiting
    And I press "Alt+Shift+ArrowUp" without waiting
    And I press "Control+Enter" without waiting
    Then the node "knobs" is a child of "hinges"
    And the node "knobs" has status "done"
    And there should be no page errors

  Scenario: The arrows move the caret between rows
    When I click the title of "handles"
    And I press "ArrowDown"
    Then the row being typed holds "pick the hinges"
    When I press "ArrowUp"
    Then the row being typed holds "choose the handles"

  Scenario: Typing in a mirror edits the node it stands for
    # A mirror has no title of its own — it is a second placement of one — so
    # the edit lands on the node, and every placement of it follows.
    When I click the title of "kitchen-herbs"
    And I select all and type "the herb bed by the back door"
    And I press "Enter"
    # The write lands in the file the NODE lives in, which is not the file the
    # placement was typed in.
    Then "garden.jsonl" holds a node titled "the herb bed by the back door"
    And "house.jsonl" holds no node titled "the herb bed by the back door"

  Scenario: Enter on a mirror makes a sibling of the PLACEMENT
    # The other half of the mirror rule: what a row SAYS belongs to the node it
    # shows, and where a row SITS belongs to the row. So the new line appears
    # where the reader is looking — in this file, beside the placement — rather
    # than beside the node it stands for, in another one.
    When I click the title of "kitchen-herbs"
    And I press "Enter"
    And I type "and one after the mirror"
    And I click away from the editor
    Then "house.jsonl" holds a node titled "and one after the mirror"
    And "garden.jsonl" holds no node titled "and one after the mirror"

  Scenario: Ctrl+Enter on a mirror ticks off the node it shows
    # And the mark is the other way round: it is a fact about the node, so the
    # write lands in the file that node lives in — the same one `set_done` on
    # that node would write.
    When I click the title of "kitchen-herbs"
    And I press "Control+Enter"
    Then the node "kitchen-herbs" has status "done"
    And "garden.jsonl" holds a node marked done titled "the herb bed by the door"

  Scenario: A zoomed node with nothing under it offers the first child
    # The other page that has no row to press a key in. The anchor is the node
    # itself rather than a sibling, which is the third of the three places a
    # new row can go.
    When I open the node "knobs"
    And I start the first line
    And I type "brushed steel, maybe"
    And I click away from the editor
    Then "house.jsonl" holds a node titled "brushed steel, maybe"
    And the tree is shown

  Scenario: An outline that holds nothing offers its first line
    When I rewrite "empty.jsonl" as:
      """
      """
    And I open the empty outline "empty.jsonl"
    And I start the first line
    And I type "the first thing"
    And I click away from the editor
    Then "empty.jsonl" holds a node titled "the first thing"
