@share-scratch
@scratch:good
Feature: Properties on a node, from the web
  A property is a named fact on a node — `pr`, `agent`, `isbn` — kept in the
  record's one open field, `custom` (website/docs/format.md). An agent writes one with
  `outlines_prop`; this is the person's door onto the same op.

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

  A CHIP IS WHERE THE PROPERTY IS WRITTEN, in place: press its key — or its
  value, where that is not a link — type, and press Enter. Escape cancels;
  leaving commits what changed and is silent when nothing did; CLEARING the
  value removes the property, which is the op's own reading of an empty value
  rather than a gesture this face invented. A `+` at the end of the run adds
  one, and that is the only place a key is typed: a rename is a removal and an
  addition, which is two ops.

  Each is one edit at the same write gate the keys and the agent's tools go
  through, so nothing is echoed — the run changes when the file says it changed.

  THE `•••` MENU CARRIES ONE PROPERTY ENTRY, and only on a node that has none:
  it used to grow an `Edit <key>…` and a `Remove <key>` per property, a menu
  that got longer every time somebody wrote a fact down. Those are gone with the
  panel they opened. What is left is the case the `+` cannot reach — a node with
  no run to sit at the end of — so there is exactly one door at any moment and
  never two.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: The first one is added from the menu, and the row says so with no gesture at all
    When I open the node menu of "handles"
    Then the node menu offers "More › Add property…"
    When I choose "More › Add property…" from the node menu
    Then the node menu of "handles" says nothing
    When I write the property "pr" holding "https://github.com/juspay/olai/pull/179" on "handles"
    Then the node "handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/179"
    And "house.olai" holds the node "handles" with "pr" set to "https://github.com/juspay/olai/pull/179"
    And the node "handles" says nothing about its properties
    And the node "handles" shows no pilcrow
    And the property editor on "handles" is closed
    And the page has not reloaded
    And there should be no page errors

  Scenario: A node that HAS one adds the next from the `+`, and the menu offers nothing
    When I open the node menu of "handles"
    And I choose "More › Add property…" from the node menu
    And I write the property "agent" holding "claude-opus" on "handles"
    Then the node "handles" shows the property "agent" holding "claude-opus"
    When I open the node menu of "handles"
    Then the node menu does not offer "More › Add property…"
    And the node menu does not offer "Edit agent…"
    And the node menu does not offer "Remove agent"
    When I press "Escape"
    And I add a property on "handles"
    And I write the property "stage" holding "review" on "handles"
    Then the properties on "handles" read "agent, stage"
    And "house.olai" holds the node "handles" with "stage" set to "review"
    And there should be no page errors

  Scenario: A chip is edited in place — press its key, type, press Enter
    When I open the node menu of "handles"
    And I choose "More › Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    Then the node "handles" shows the property "stage" holding "review"
    When I edit the property "stage" on "handles"
    Then the property editor on "handles" holds "review"
    And the property editor on "handles" offers no key box
    When I type "addressing" into the property editor on "handles"
    Then the node "handles" shows the property "stage" holding "addressing"
    And "house.olai" holds the node "handles" with "stage" set to "addressing"
    And the node "handles" says nothing about its properties
    And there should be no page errors

  Scenario: Clicking away is the other commit — once, and as silently
    When I open the node menu of "handles"
    And I choose "More › Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    When I edit the property "stage" on "handles"
    And I type "addressing" into the property editor on "handles" without pressing Enter
    And I click away from the property editor on "handles"
    Then the property editor on "handles" is closed
    And the node "handles" shows the property "stage" holding "addressing"
    And "house.olai" holds the node "handles" with "stage" set to "addressing"
    And the node "handles" says nothing about its properties
    And there should be no page errors

  Scenario: The same chip edited twice — every open answers for itself
    When I open the node menu of "handles"
    And I choose "More › Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    When I edit the property "stage" on "handles"
    And I type "addressing" into the property editor on "handles"
    Then the node "handles" shows the property "stage" holding "addressing"
    When I edit the property "stage" on "handles"
    Then the property editor on "handles" holds "addressing"
    When I type "submitted" into the property editor on "handles" without pressing Enter
    And I click away from the property editor on "handles"
    Then the property editor on "handles" is closed
    And the node "handles" shows the property "stage" holding "submitted"
    And "house.olai" holds the node "handles" with "stage" set to "submitted"
    And the node "handles" says nothing about its properties
    And there should be no page errors

  Scenario: A value that is not a link is the second way in
    When I open the node menu of "handles"
    And I choose "More › Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    When I press the value of "stage" on "handles"
    Then the property editor on "handles" holds "review"
    And there should be no page errors

  Scenario: Clearing the value removes the property — the op's own reading
    When I open the node menu of "handles"
    And I choose "More › Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    Then the node "handles" shows the property "stage" holding "review"
    When I edit the property "stage" on "handles"
    And I type "" into the property editor on "handles"
    Then the node "handles" shows no property "stage"
    And "house.olai" holds the node "handles" with no "stage"
    And the node "handles" shows no drawer
    And the node "handles" shows no pilcrow
    And there should be no page errors

  Scenario: A chip opened while somebody else writes the same key does not put the old value back
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"stage":"review"}}
      """
    And I open the outline "house.olai"
    And I mark the page
    When I edit the property "stage" on "handles"
    Then the property editor on "handles" holds "review"
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"stage":"addressing"}}
      """
    And I click away from the property editor on "handles"
    Then the property editor on "handles" is closed
    And the node "handles" shows the property "stage" holding "addressing"
    And "house.olai" holds the node "handles" with "stage" set to "addressing"
    And the node "handles" says nothing about its properties
    And there should be no page errors

  Scenario: A typed commit meets an agent's write mid-edit — refused, naming what it found — and even a reopen re-reads the premise
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"stage":"review"}}
      """
    And I open the outline "house.olai"
    And I mark the page
    When I edit the property "stage" on "handles"
    And I type "submitted" into the property editor on "handles" without pressing Enter
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","custom":{"airing":"2026-08-10"}}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"stage":"audit"}}
      """
    Then the node "kitchen" shows the property "airing" holding "2026-08-10"
    And the property editor on "handles" holds "submitted"
    When I press "Enter"
    Then the property editor on "handles" is closed
    Then the node "handles" refuses the property write with "it now says `audit`"
    And the node "handles" shows the property "stage" holding "audit"
    And "house.olai" holds the node "handles" with "stage" set to "audit"
    When I edit the property "stage" on "handles"
    And the property editor on "handles" holds "audit"
    And I type "the third opinion" into the property editor on "handles" without pressing Enter
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","custom":{"airing":"2026-08-12"}}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"stage":"declared"}}
      """
    Then the node "kitchen" shows the property "airing" holding "2026-08-12"
    And the property editor on "handles" holds "the third opinion"
    When I press "Enter"
    Then the property editor on "handles" is closed
    And the node "handles" refuses the property write with "expected to replace (`audit`)"
    And the node "handles" refuses the property write with "it now says `declared`"
    And the node "handles" shows the property "stage" holding "declared"
    And "house.olai" holds the node "handles" with "stage" set to "declared"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A chip whose key disappears under an open, typed editor is refused — the resurrect dies at the gate
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"stage":"review"}}
      """
    And I open the outline "house.olai"
    And I mark the page
    When I edit the property "stage" on "handles"
    And I type "submitted" into the property editor on "handles" without pressing Enter
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles"}
      """
    Then the property editor on "handles" is closed
    And the node "handles" shows no property "stage"
    And "house.olai" holds the node "handles" with no "stage"
    And the node "handles" refuses the property write with "the key is gone"
    And there should be no page errors

  Scenario: A value that names something keeps its link however long it is
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"pr":"https://github.com/juspay/olai/pull/369#discussion_r1234567890","note":"a sentence long enough to be prose rather than a fact, which is what the fold is for"}}
      """
    And I open the outline "house.olai"
    Then the property "pr" on "handles" is a "away" door to "https://github.com/juspay/olai/pull/369#discussion_r1234567890"
    And the property "pr" on "handles" is not folded
    And the property "note" on "handles" is folded
    And there should be no page errors

  Scenario: A shadow custom key does not open an editor inside the system chip
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","date":"2026-08-10","custom":{"date":"whenever the tiler is free"}}
      """
    And I open the node "handles"
    Then the zoomed node is "handles"
    When I edit the custom property "date" on "handles"
    Then the property editor on "handles" holds "whenever the tiler is free"
    And exactly 1 property editor is open on "handles"
    And the system property "date" on "handles" offers no editor
    And there should be no page errors

  Scenario: A property holding a LIST is removed by clearing it
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"reviewers":["pi","grok"],"stage":"review"}}
      """
    And I open the outline "house.olai"
    And I mark the page
    Then the node "handles" shows the property "reviewers" holding "pi, grok"
    When I edit the property "reviewers" on "handles"
    Then the property editor on "handles" holds "pi, grok"
    When I click away from the property editor on "handles"
    Then the node "handles" shows the property "reviewers" holding "pi, grok"
    And the node "handles" says nothing about its properties
    When I edit the property "reviewers" on "handles"
    And I type "" into the property editor on "handles"
    Then the node "handles" shows no property "reviewers"
    And "house.olai" holds the node "handles" with no "reviewers"
    And there should be no page errors

  Scenario: Escape writes nothing, and neither does opening a chip and leaving it
    When I open the node menu of "handles"
    And I choose "More › Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    When I edit the property "stage" on "handles"
    And I leave the property editor on "handles" without pressing Enter
    Then the property editor on "handles" is closed
    And the node "handles" shows the property "stage" holding "review"
    And the node "handles" says nothing about its properties
    When I edit the property "stage" on "handles"
    And I click away from the property editor on "handles"
    Then the property editor on "handles" is closed
    And the node "handles" shows the property "stage" holding "review"
    And the node "handles" says nothing about its properties
    And there should be no page errors

  Scenario: A row draws the custom keys, and the node's page draws them all
    When I open the node menu of "handles"
    And I choose "More › Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    Then the node "handles" shows the property "stage" holding "review"
    And the node "handles" shows no property "id"
    When I open the node "handles"
    Then the zoomed node is "handles"
    And the node "handles" shows the property "id" holding "handles"
    And the property "id" on "handles" is read-only
    And the node "handles" shows the property "stage" holding "review"
    When I edit the property "stage" on "handles"
    And I type "addressing" into the property editor on "handles"
    Then the node "handles" shows the property "stage" holding "addressing"
    And "house.olai" holds the node "handles" with "stage" set to "addressing"
    And there should be no page errors

  Scenario: What the pilcrow adds is the note, and never what the row already shows
    When I open the node menu of "order"
    And I choose "More › Add property…" from the node menu
    And I write the property "stage" holding "review" on "order"
    Then the node "order" shows the property "stage" holding "review"
    And the node "order" shows a pilcrow
    When I open the note of "order"
    Then the node "order" shows the property "stage" holding "review"
    And the row "order" is open
    And there should be no page errors

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
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"reviewer":"basil"}}
      """
    And I open the outline "house.olai"
    Then the property "reviewer" on "handles" is a "node" door to "/#basil"
    When I follow the property "reviewer" on "handles"
    Then the unified destination row "basil" is selected
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
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"worktree":".worktrees/pda","agent":"claude-opus","brief":"finishes.md"}}
      """
    And I open the outline "house.olai"
    Then the properties on "handles" read "worktree, agent, brief"
    And there should be no page errors

  Scenario: A value too long to be a fact is drawn as its first words
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
    When I hold a finger on the node "handles"
    Then the node menu is open
    When I tap "More › Add property…" in the node menu
    Then the property editor on "handles" fits the screen
    And the property boxes on "handles" ask for a Next key then a Done key
    When I write the property "pr" holding "https://github.com/juspay/olai/pull/179" on "handles"
    Then the node "handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/179"
    And "house.olai" holds the node "handles" with "pr" set to "https://github.com/juspay/olai/pull/179"
    When I add a property on "handles"
    Then the property editor on "handles" fits the screen
    When I write the property "agent" holding "claude-opus" on "handles"
    Then the node "handles" shows the property "agent" holding "claude-opus"
    And there should be no page errors

  Scenario: The node's own facts have no entries in the menu
    When I open the node menu of "order"
    Then the node menu does not offer "Edit date…"
    And the node menu does not offer "Remove date"
    And the node menu does not offer "Remove id"
    And the node menu offers "Change date…"

  Scenario: A search result carries the properties, and says which one answered
    When I open the node menu of "handles"
    And I choose "More › Add property…" from the node menu
    And I write the property "agent" holding "claude-opus" on "handles"
    And I add a property on "handles"
    And I write the property "pr" holding "https://github.com/juspay/olai/pull/192" on "handles"
    Then the node "handles" shows the property "agent" holding "claude-opus"

    When I search the header for "prop:agent=claude-opus"
    Then the header search lists the node "choose the handles"
    And the header search result "choose the handles" shows the property "agent" holding "claude-opus"
    And the header search result "choose the handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/192"
    And the header search result "choose the handles" marks "agent" as why it matched
    And there should be no page errors
