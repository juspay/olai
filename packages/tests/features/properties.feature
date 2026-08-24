@share-scratch
@scratch:good
Feature: Properties on a node, from the web
  A property is a named fact on a node — `pr`, `agent`, `isbn` — kept in the
  record's one open field, `custom` (docs/format.md). An agent writes one with
  `set_prop`; this is the person's door onto the same op.

  They are read ON THE ROW, under its title, as a wrapping run of chips: the key
  small and muted, the value first-class. AUTO-SHOWN, whether the row is open or
  not — a fact behind a fold is a fact nobody reads, and these are short facts by
  rule, so the display's job is to make five of them cost one line rather than
  five. What the pilcrow opens is therefore the note, and only the note.

  A value that NAMES A THING is a link. A path in this directory opens that
  file's page, a value that is a node's id opens that node, a URL leaves the
  tab, and a date wears the date badge and opens that day. Everything else stays
  the text it is — a wrong door is worse than no door, so there is no fuzzy
  matching here and nothing is a link because it merely looks like one.

  A ROW draws the CUSTOM keys only. The node's own facts — its id, the mark it
  has, its date — are already on the row, in the glyph and on the date badge
  and in the address, so repeating them under the title would put two spellings
  of one fact on one screen. A page ABOUT one node still draws them all, which
  is where the id is read.

  The `•••` menu writes the custom half: add one, change what one holds, take
  one off. Each is one edit at the same write gate the keys and the agent's
  tools go through, so nothing is echoed — the run changes when the file says
  it changed.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: Adding one writes it, and the row says so with no gesture at all
    When I open the node menu of "handles"
    Then the node menu offers "Add property…"
    When I choose "Add property…" from the node menu
    Then the property editor is open
    And the property editor holds "" and ""
    # ...and the menu says NOTHING: an entry answers with what it has to say,
    # and opening a panel has nothing to say.
    And the node menu of "handles" says nothing
    When I write the property "pr" holding "https://github.com/juspay/olai/pull/179"
    # THE WHOLE POINT: no pilcrow pressed, no row opened. The fact is on the row
    # the moment the file says it is.
    Then the node "handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/179"
    And "house.olai" holds the node "handles" with "pr" set to "https://github.com/juspay/olai/pull/179"
    # `handles` has no note, so it has nothing behind a mark — a run that is
    # already on the row is not something to open.
    And the node "handles" shows no pilcrow
    And the property editor is closed
    And the page has not reloaded
    And there should be no page errors

  Scenario: What the pilcrow adds is the note, and never what the row already shows
    # The question the auto-show ruling had to answer: does opening a row say
    # anything twice? It cannot — the run is not behind the mark.
    When I open the node menu of "order"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review"
    Then the node "order" shows the property "stage" holding "review"
    And the node "order" shows a pilcrow
    When I open the note of "order"
    Then the node "order" shows the property "stage" holding "review"
    And the row "order" is open
    And there should be no page errors

  Scenario: A row draws the custom keys, and the node's page draws them all
    # THE SPLIT, both halves in one scenario because they are one decision. On
    # a row the id would be a second spelling of what the bullet's link already
    # is; on a page ABOUT the node it is the whole reason the system half
    # exists, since an id is what every tool call takes.
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review"
    Then the node "handles" shows the property "stage" holding "review"
    And the node "handles" shows no property "id"
    When I open the node "handles"
    Then the zoomed node is "handles"
    And the node "handles" shows the property "id" holding "handles"
    And the property "id" on "handles" is read-only
    And the node "handles" shows the property "stage" holding "review"

  Scenario: A property it carries is offered for editing, with what it holds
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review"
    Then the node "handles" shows the property "stage" holding "review"
    When I open the node menu of "handles"
    Then the node menu offers "Edit stage…"
    When I choose "Edit stage…" from the node menu
    Then the property editor holds "stage" and "review"
    # A rename is a removal and an addition — two ops, which is exactly the two
    # calls an agent makes — so the key is not something this panel can type in.
    And the property editor's key is fixed
    When I write the property "stage" holding "addressing"
    Then the node "handles" shows the property "stage" holding "addressing"
    And "house.olai" holds the node "handles" with "stage" set to "addressing"
    And there should be no page errors

  Scenario: Removing one is a menu entry and takes the key off
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review"
    Then the node "handles" shows the property "stage" holding "review"
    When I open the node menu of "handles"
    Then the node menu offers "Remove stage"
    When I choose "Remove stage" from the node menu
    Then the node "handles" shows no property "stage"
    And "house.olai" holds the node "handles" with no "stage"
    # ...and the row is back to drawing nothing at all, rather than a run
    # holding only the facts nobody asked to see.
    And the node "handles" shows no drawer
    And the node "handles" shows no pilcrow
    And there should be no page errors

  Scenario: Leaving the editor writes nothing
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I leave the property editor
    Then the property editor is closed
    And the node "handles" shows no drawer
    And there should be no page errors

  # ── the doors ────────────────────────────────────────────────────────

  Scenario: A value that names a document in this directory opens that document
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"brief":"finishes.md"}}
      """
    And I open the outline "house.olai"
    Then the property "brief" on "handles" is a "document" door to "/finishes.md"
    When I follow the property "brief" on "handles"
    Then the address is "/finishes.md"
    And there should be no page errors

  Scenario: A value that IS a node's id opens that node — assignment becomes navigation
    # The exact-id rule, and the whole reason it can be trusted: `basil` is a
    # node `garden.olai` declares, so this is a match against the SET rather
    # than a guess about a word.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"reviewer":"basil"}}
      """
    And I open the outline "house.olai"
    Then the property "reviewer" on "handles" is a "node" door to "/#basil"
    When I follow the property "reviewer" on "handles"
    Then the zoomed node is "basil"
    And there should be no page errors

  Scenario: A date wears the date badge and opens its day
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"soak-until":"2026-08-10"}}
      """
    And I open the outline "house.olai"
    Then the property "soak-until" on "handles" is a "day" door to "/d/2026-08-10"
    When I follow the property "soak-until" on "handles"
    Then the address is "/d/2026-08-10"
    And there should be no page errors

  Scenario: A URL is a link out of the tab, and everything else stays text
    # Both halves in one scenario because they are one rule read in two
    # directions: the whole value IS the thing, or the value is not a door.
    # `claude-opus` is id-shaped and names no node; `merge` is a sentence; and
    # the `pr` here has a URL INSIDE it, which is not the same as being one.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"home":"https://example.invalid/one","agent":"claude-opus","merge":"the human approves","pr":"#179 https://example.invalid/one landed"}}
      """
    And I open the outline "house.olai"
    Then the property "home" on "handles" is a "away" door to "https://example.invalid/one"
    And the property "home" on "handles" opens in a tab of its own
    And the property "agent" on "handles" is not a link
    And the property "merge" on "handles" is not a link
    And the property "pr" on "handles" is not a link
    And there should be no page errors

  Scenario: The file's own key order stands, and nothing re-sorts it
    # A record a HAND wrote holds its keys in the order the person thought
    # about the lane in. Alphabetical is what olai's own WRITER produces, not
    # what a drawer imposes — so a run over a hand-written record reads as it
    # was written.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"worktree":".worktrees/pda","agent":"claude-opus","brief":"finishes.md"}}
      """
    And I open the outline "house.olai"
    Then the properties on "handles" read "worktree, agent, brief"
    And there should be no page errors

  Scenario: A value too long to be a fact is drawn as its first words
    # Move 3's fold, which is the safety net rather than the goal: props are
    # short facts by rule, and the fold is what stops a record that broke the
    # rule from putting the wall back on every row of the board.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"stage":"review","verdict":"DO-NOT-OBJECT at c2704bc6 — the owner map verified against the diff, and the wait discipline holds"}}
      """
    And I open the outline "house.olai"
    Then the property "verdict" on "handles" is folded
    And the property "stage" on "handles" is not folded
    And the property "verdict" on "handles" reads "DO-NOT-OBJECT at c2704bc6 —"
    When I open the property "verdict" on "handles"
    Then the property "verdict" on "handles" reads "the wait discipline holds"
    And there should be no page errors

  @phone
  Scenario: The run and its editor work with a thumb, at 390 points
    # The `•••` is not drawn on a phone at all — a gutter that wide would leave
    # no room for the title — so the run's editor door here is the same long
    # press every other verb uses (`on_a_phone.feature`). What is new is the
    # panel: two boxes and two buttons in a flex row, which is comfortable at
    # 1200pt and a claim at 390, and the inputs keep the 44px a finger is given
    # while a laptop does not pay for it (`md:min-h-0`).
    When I hold a finger on the node "handles"
    Then the node menu is open
    When I tap "Add property…" in the node menu
    Then the property editor is open
    And the property editor fits the screen
    When I write the property "pr" holding "https://github.com/juspay/olai/pull/179"
    Then the node "handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/179"
    And "house.olai" holds the node "handles" with "pr" set to "https://github.com/juspay/olai/pull/179"
    And there should be no page errors

  Scenario: The node's own facts have no entries in the menu
    # `order` carries a date, and the entry for it is `Change date…`. An
    # `Edit date…` beside it would be a second spelling of one write — and the
    # one `set_prop` refuses by name.
    When I open the node menu of "order"
    Then the node menu does not offer "Edit date…"
    And the node menu does not offer "Remove date"
    And the node menu does not offer "Remove id"
    And the node menu offers "Change date…"

  Scenario: A search result carries the properties, and says which one answered
    # The scenario PR #192 could not write. It put the whole `custom` map on a
    # hit and deliberately left the row alone, because "should a reader SEE a
    # hit's properties" was a product question nobody had ruled — so there was
    # nothing on screen to assert. It is ruled now, and this is the loop it
    # bought: write a fact on a node, then ask the header box for it and get the
    # fact back on the row, without opening anything.
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "agent" holding "claude-opus"
    And I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "pr" holding "https://github.com/juspay/olai/pull/192"
    Then the node "handles" shows the property "agent" holding "claude-opus"

    # The board's own query, asked by a person this time. The row draws both
    # properties — a hit carries the whole map — and marks the one the query
    # named, which leads so a narrow panel ellipsizes the others instead.
    When I search the header for "prop:agent=claude-opus"
    Then the header search lists the node "choose the handles"
    And the header search result "choose the handles" shows the property "agent" holding "claude-opus"
    And the header search result "choose the handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/192"
    And the header search result "choose the handles" marks "agent" as why it matched
    And there should be no page errors
