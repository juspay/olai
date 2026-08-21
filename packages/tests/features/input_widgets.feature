@share-scratch
@scratch:good
Feature: The three input widgets
  Workflowy's three trigger characters, in a row's title: `!` a day in words,
  `#` / `@` a tag the set already uses, `((` a node to place a second copy of.

  One rule underneath all three: what is armed is a function of the TEXT and
  the CARET, so backspacing over the trigger shuts the list and typing it again
  opens the same one. There is no "the picker is open" mode to get out of step
  with the line.

  And one rule about what they WRITE: a tag is text, so it goes into the draft
  and commits with it — but a day and a placement are OPS, sent through the
  same `edit` gate the keys and the agent's tools go through (`set_date`,
  `add_mirror`). Nothing is echoed: the pill appears and the row appears when
  the file says they did.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  # ── `!` — a day, in words ───────────────────────────────────────────

  Scenario: A `!` in a title opens the day list, and every row says its day
    # The date out loud beside the phrase is the one thing this widget may not
    # leave out: `next friday` is an argument about which Friday, and nobody
    # should have to press Enter to find out which one they are getting.
    When I click the title of "handles"
    And I type " !2026-09-01"
    Then the date completions are open
    And the completions list "2026-09-01"
    And the completion "2026-09-01" says "Tue 1 Sep 2026"

  Scenario: A bare `!` offers the three days a person reaches for
    When I click the title of "handles"
    And I type " !"
    Then the date completions are open
    And the completions list "today, tomorrow, next week"
    And the active completion is "today"
    When I press "ArrowDown"
    Then the active completion is "tomorrow"

  Scenario: Choosing a day sets the date and takes the words back out
    # ONE `date` edit, at the gate `set_date` goes through — and the `!2026-09-01`
    # is not something anybody wants left in a title, so it comes out of the line
    # before the line is committed.
    When I click the title of "handles"
    And I type " !2026-09-01"
    And I press "Enter"
    Then the row being typed holds "choose the handles"
    And "house.olai" holds the node "handles" dated "2026-09-01"
    And "house.olai" holds a node titled "choose the handles"
    And no completions are open
    And the page has not reloaded
    And there should be no page errors

  Scenario: The natural-language half, against the clock
    # `tomorrow` is the reader's own tomorrow, so the assertion works it out the
    # way the client does rather than naming a date this file cannot know.
    When I click the title of "handles"
    And I type " !tomorrow"
    And I press "Enter"
    Then "house.olai" holds the node "handles" dated tomorrow
    And there should be no page errors

  Scenario: A row that does not exist yet is written first, then dated
    # There is no node to put a date on until the `add` has landed, so the
    # commit comes first — the same order every structural key follows. Both
    # halves are asserted: without the date one, this would stay green if
    # `dated` quietly did nothing once the add had gone through, and this is the
    # only scenario of that path.
    When I click the title of "knobs"
    And I press "Enter"
    And I type "ring the joiner !2026-09-01"
    And I press "Enter"
    Then "house.olai" holds a node titled "ring the joiner"
    And "house.olai" holds a node titled "ring the joiner" dated "2026-09-01"
    And the row being typed holds "ring the joiner"
    And there should be no page errors

  Scenario: The caret carries on in the row a day was picked in
    # A widget's write is not the end of the line. Neither of the two OP widgets
    # can MOVE the row it was typed in — a day changes what other pages list,
    # never this one's order — so neither may claim a redraw is owed
    # (`edit/editing.tsx`'s `structural`): the editor drops a blur while it is
    # waiting for a frame that moves the row, and a blur dropped is a line
    # neither committed nor closed. Nothing else in the suite types MORE text
    # after a widget has written and then leaves the row.
    When I click the title of "handles"
    And I type " !2026-09-01"
    And I press "Enter"
    Then "house.olai" holds the node "handles" dated "2026-09-01"
    When I type " and the hinges"
    And I click away from the editor
    Then "house.olai" holds a node titled "choose the handles and the hinges"
    And no row is being edited
    And there should be no page errors

  # ── `#` and `@` — the tags the set already uses ─────────────────────

  Scenario: A bare `#` shows what this set uses, most used first
    When I click the title of "knobs"
    And I type " #"
    Then the tag completions are open
    And the completions list "#home, #outdoors"

  Scenario: Typing narrows it, and choosing writes the tag verbatim
    # No trailing space: a title is stored verbatim, so a character nobody
    # typed is a character in somebody's git history. What ends the list is the
    # completion being taken, not a space nobody asked for.
    When I click the title of "knobs"
    And I type " #ho"
    Then the completions list "#home"
    When I press "Enter"
    Then the row being typed holds "pick the knobs #home"
    And no completions are open
    When I click away from the editor
    Then "house.olai" holds a node titled "pick the knobs #home"
    And there should be no page errors

  Scenario: A tag is a whole word, so a space ends it
    When I click the title of "knobs"
    And I type " #home now"
    Then no completions are open

  Scenario: A tag written in a NOTE is vocabulary too
    # The list is read off the derivation's own tag index (`Derived.taggedBy`),
    # which files a record under every tag its title OR its note writes — so a
    # word somebody has only ever used in prose under a row is offered back to
    # them. It used to be invisible here, by accident of a walk that looked at
    # titles only.
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","desc":"ask the #hob people about the cut-out"}
      {"id":"knobs","parent":"kitchen","ord":"a2","title":"pick the knobs"}
      """
    Then the node "handles" is not shown
    When I click the title of "knobs"
    And I type " #h"
    Then the tag completions are open
    And the completions list "#hob, #home"

  Scenario: A tag is counted once per node, however often that node writes it
    # The number beside a name is how many NODES carry it, which is what the
    # widget has always claimed and what one entry per record in the index now
    # makes true of a row that says the word twice.
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home #home","desc":"and again #home"}
      {"id":"knobs","parent":"kitchen","ord":"a1","title":"pick the knobs"}
      """
    Then the node "handles" is not shown
    When I click the title of "knobs"
    And I type " #ho"
    Then the completions list "#home"
    And the completion "#home" says "1"

  Scenario: `@` is the other namespace, and it offers only its own
    # `#alice` and `@alice` are different tags. A widget that offered one under
    # the other's sigil would be inventing tags the set does not hold.
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"ask","parent":"kitchen","ord":"a1","title":"ask @alice about the alcove"}
      {"id":"knobs","parent":"kitchen","ord":"a2","title":"pick the knobs"}
      """
    Then the node "handles" is not shown
    When I click the title of "knobs"
    And I type " @a"
    Then the tag completions are open
    And the completions list "@alice"
    When I select all and type "pick the knobs #h"
    Then the completions list "#home"

  Scenario: An `@` inside a word is an email address
    When I click the title of "knobs"
    And I type " srid@srid"
    Then no completions are open

  # ── `((` — a node to mirror ─────────────────────────────────────────

  Scenario: `((` searches the set, and says where each hit sits
    # The SERVER's search — the same procedure the ⌘K palette and the header box
    # call — so what this finds and what an agent's `search_nodes` finds cannot
    # drift.
    When I click the title of "knobs"
    And I type " ((compost"
    Then the mirror completions are open
    And the completions include "the compost heap"
    # ...and WHERE it sits, on its own line — a bare title in a list of
    # strangers means nothing, and the node being offered lives in another file.
    And the completion "the compost heap" sits at "garden #outdoors"

  Scenario: A draft line with nothing else in it BECOMES the mirror
    # Workflowy's gesture exactly: Enter, `((`, choose. An empty draft writes no
    # node, so the row that was going to be minted there is the placement
    # instead — at the same anchor, which is where the reader was looking.
    When I click the title of "knobs"
    And I press "Enter"
    And I type "((compost"
    # The search is the SERVER's, so the list arrives a round trip later — a
    # scenario that pressed Enter into an empty list would be pressing the row's
    # own `Enter` and writing a node titled `((compost`.
    And the mirror completions are open
    And I press "Enter"
    Then "house.olai" holds a mirror of "compost" under "install"
    And "house.olai" holds no node titled "((compost"
    And there should be no page errors

  Scenario: A line that has words keeps them, and the mirror is the next row
    # A mirror is a whole row in this format — `{id, parent, ord, mirror}`, with
    # no text of its own — so it cannot go inside a sentence. Beside it is the
    # honest reading of the same gesture.
    When I click the title of "knobs"
    And I type " ((compost"
    And the mirror completions are open
    And I press "Enter"
    Then "house.olai" holds a node titled "pick the knobs"
    And "house.olai" holds a mirror of "compost" under "install"
    And the row being typed holds "pick the knobs"
    And there should be no page errors
    # ...and the caret carries on in it, exactly as it does after a day: the
    # placement is a new sibling AFTER this row, so this row has not moved and
    # no redraw is owed for it.
    When I type " and the hinges"
    And I click away from the editor
    Then "house.olai" holds a node titled "pick the knobs and the hinges"
    And no row is being edited

  Scenario: The placement is drawn, and ⌘Z retires it
    # A pointer's write and a keystroke's file onto one stack, so the chord does
    # not mean two things depending on which hand made the edit. The inverse of
    # `add_mirror` is `remove_mirror`, named by the placement the write minted.
    # Escape first: the draft must stay closed after the write lands. It used
    # to bounce back when add_mirror was still in flight (`kept` in draft.ts).
    # The chord after that spends the inverse `send` recorded — caret.ts waits
    # for the placement to be drawn, which is this tab having the way back.
    When I click the title of "knobs"
    And I type " ((compost"
    And the mirror completions are open
    And I press "Enter"
    Then "house.olai" holds a mirror of "compost" under "install"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then "house.olai" holds no mirror of "compost"
    And there should be no page errors


  Scenario: Enter places nothing for a row the search has moved past
    # The `((` list is the SERVER's, so it holds still through the settle and
    # the round trip after it — and taking a row of it mints a placement. This
    # door was gated by hand at #294; it goes through the primitive's own taker
    # now (`client/settled.ts`), and this is the pin that says the two are the
    # same promise.
    When I click the title of "knobs"
    And I type " ((compost"
    Then the mirror completions are open
    And the completions include "the compost heap"
    When I retype the row as "pick the knobs ((mint" and press Enter at once
    # Waited out whole: by the time the rows answer the new query, anything
    # that key wrongly placed has landed and the file would say so.
    Then the completions include "split the mint"
    And "house.olai" holds no mirror of "compost"
    # ...and the key is not lost to the reader, only to the wrong row.
    When I press "Enter"
    Then "house.olai" holds a mirror of "mint" under "install"
    And there should be no page errors

  # ── the keys, and what happens when nothing matches ──────────────────

  Scenario: Escape puts the list away and keeps what was typed
    When I click the title of "handles"
    And I type " !tom"
    Then the date completions are open
    When I press "Escape"
    Then no completions are open
    And the row being typed holds "choose the handles !tom"

  Scenario: With no list up, the keys are the row's own again
    # A trigger that matches nothing draws nothing — and a key a person cannot
    # see the effect of must go on meaning what it has always meant.
    When I click the title of "knobs"
    And I type " #zzz"
    Then no completions are open
    When I press "Escape"
    Then no row is being edited
    And "house.olai" holds a node titled "pick the knobs"

  Scenario: A pointer takes a row without losing the caret
    # The row prevents the default on mousedown, so choosing with the mouse must
    # not blur the line being typed.
    When I click the title of "knobs"
    And I type " #"
    And I choose "#outdoors" from the completions
    Then the row being typed holds "pick the knobs #outdoors"
    And there should be no page errors

  # ── the list paints over the page ───────────────────────────────────
  #
  # The same stacking question as the `•••` panel and its said line
  # (`menu_panel.feature`): a sticky section heading is a stacking context
  # at LAYER.row, and a box left in the title cell is cut in two. Zoomed
  # into `kitchen`, `order` and `install` are those two headings; `!` on
  # the first hangs the shortlist over the second. `elementFromPoint` at
  # the overlap is the only honest assertion.

  Scenario: Completions paint over a later section heading
    Given I zoom into the node "kitchen"
    When I click the title of "order"
    And I type " !"
    Then the date completions are open
    And the completions take the pointer where they cross the section heading of "install"
    And there should be no page errors
