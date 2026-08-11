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

  Scenario: A draft is an editor, not a write
    # The no-optimistic-UI rule from the other side: what is typed is nowhere
    # near the disk until something commits it.
    When I click the title of "knobs"
    And I select all and type "pick the little brass knobs"
    Then "house.jsonl" holds no node titled "pick the little brass knobs"
    And "house.jsonl" holds a node titled "pick the knobs"

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

  Scenario: Shift+Enter writes the note, and the rendering comes back
    When I click the title of "handles"
    And I press "Shift+Enter"
    Then the note of "handles" is being typed
    When I type "the alcove is **1830mm** wide"
    And I press "Shift+Enter"
    Then the note of "handles" is no longer being typed
    When I click the note of "handles"
    Then the description of "handles" renders bold text "1830mm"

  Scenario: A refused write keeps the draft and says why
    When I click the title of "handles"
    And I select all and type ""
    And I click away from the editor
    Then the refusal says "a node needs a title"
    And the row being typed holds ""
    And "house.jsonl" holds a node titled "choose the handles"

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

  Scenario: An outline that holds nothing offers its first line
    When I rewrite "empty.jsonl" as:
      """
      """
    And I open the empty outline "empty.jsonl"
    And I start the first line
    And I type "the first thing"
    And I click away from the editor
    Then "empty.jsonl" holds a node titled "the first thing"
