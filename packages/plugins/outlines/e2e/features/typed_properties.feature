@share-scratch
@scratch:typed
Feature: A property key that declares its type
  A property value is any string, and nothing refuses a sloppy one — unless the
  vault has DECLARED what that key holds. Declarations are an outline like any
  other, `_olai/Properties.olai`: one node per key, the title IS the key, the
  type in that node's own props, and an enum's variants are its children
  (website/docs/format.md).

  Then the write gate refuses a value that does not fit, in the same words
  wherever the write came from — and this is the person's door onto that: the
  chip editor commits a `outlines_prop` at the same gate an agent's does, so a typed
  refusal has to arrive HERE, in full, rather than as a value that quietly went
  back to what it was.

  And the reading side: a key declared `int` or `date` compares, so `..` becomes
  honest and `prop:records=190..200` is a question the header box can answer
  (website/docs/search.md). A range on a key nobody declared is refused with the reason,
  because comparing text as if it were a number is the lie types exist to
  prevent.

  And the DISPLAY side, which is the same declaration read by the other arm: a
  declared value NAMES something, and one place answers what — the gate and the
  chip cannot disagree about the same string (`@olai/format`'s `meaning.ts`).
  So a `doc` key whose row says `base: root` resolves from the served root
  wherever it was written, a `ref` chip draws the variant's title over the id it
  stores, and a `path` that points outside this directory draws no door at all.

  `@scratch:` because these write the directory they are served. They share one
  copy per worker (`@share-scratch`); the corpus is restored between scenarios.

  Scenario: A typed refusal lands in the chip run, in the ops layer's own words
    Given I open the outline "lanes.olai"
    And I mark the page
    When I edit the property "merge" on "chips"
    And I type "AUTO: grok review folded + CI green" into the property editor on "chips"
    Then the property editor on "chips" is closed
    And the node "chips" refuses the property write with "`merge` is `auto` | `human`"
    And the node "chips" shows the property "merge" holding "automatic"
    And "lanes.olai" holds the node "chips" with "merge" set to "auto"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The refusal offers the variant a value is a typo of
    Given I open the outline "lanes.olai"
    And I mark the page
    When I edit the property "agent" on "chips"
    And I type "clade" into the property editor on "chips"
    Then the node "chips" refuses the property write with "did you mean `claude`?"
    And the node "chips" shows the property "agent" holding "pi"
    And there should be no page errors

  Scenario: A moved key refuses before the typed gate's work is spent — one gesture, one refusal
    Given I open the outline "lanes.olai"
    And I mark the page
    When I edit the property "merge" on "chips"
    And I type "AUTO: grok review folded + CI green" into the property editor on "chips" without pressing Enter
    When I rewrite "lanes.olai" as:
      """
      {"id":"lanes","ord":"a0","title":"the lanes"}
      {"id":"backlinks","parent":"lanes","ord":"a0","title":"the doc-backlinks lane","custom":{"records":"189","agent":"grok","merge":"auto","dispatched":"2026-08-19T09:00:00-04:00"}}
      {"id":"props","parent":"lanes","ord":"a1","title":"the typed-properties lane","custom":{"records":"193","agent":"claude","merge":"human","dispatched":"2026-08-25T10:06:00-04:00","brief":"briefs/tp.md","worktree":".worktrees/typed-properties"}}
      {"id":"chips","parent":"lanes","ord":"a2","title":"the chip-editor lane","custom":{"records":"200","agent":"pi","merge":"human","dispatched":"2026-08-21"}}
      {"id":"far","parent":"lanes","ord":"a3","title":"a lane from long ago","custom":{"records":"999"}}
      """
    Then the node "far" shows the property "records" holding "999"
    When I press "Enter"
    Then the property editor on "chips" is closed
    And the node "chips" refuses the property write with "it now says `human`"
    And the node "chips" shows the property "merge" holding "the human merges"
    And "lanes.olai" holds the node "chips" with "merge" set to "human"
    And there should be no page errors

  Scenario: A value that FITS lands, and lands as the one stored spelling
    Given I open the outline "lanes.olai"
    And I mark the page
    When I edit the property "dispatched" on "chips"
    And I type "2026-8-30" into the property editor on "chips"
    Then the node "chips" shows the property "dispatched" holding "2026-08-30"
    And "lanes.olai" holds the node "chips" with "dispatched" set to "2026-08-30"
    And the node "chips" says nothing about its properties
    And there should be no page errors

  Scenario: An undeclared key on the same node still takes anything
    Given I open the outline "lanes.olai"
    And I mark the page
    When I edit the property "terminal" on "far"
    And I type "a uuid, and a longer remark about it" into the property editor on "far"
    Then the node "far" shows the property "terminal" holding "a uuid, and a longer remark about it"
    And "lanes.olai" holds the node "far" with "terminal" set to "a uuid, and a longer remark about it"
    And there should be no page errors

  Scenario: A span on an int key answers, and compares as a number
    Given I open the app
    When I search the header for "prop:records=190..200"
    Then the header search lists the node "the typed-properties lane"
    And the header search lists the node "the chip-editor lane"
    And the header search does not list the node "the doc-backlinks lane"
    And the header search does not list the node "a lane from long ago"
    And there should be no page errors

  Scenario: A span on a date key reuses the day grammar
    Given I open the app
    When I search the header for "prop:dispatched=2026-08-20.."
    Then the header search lists the node "the typed-properties lane"
    And the header search lists the node "the chip-editor lane"
    And the header search does not list the node "the doc-backlinks lane"
    And there should be no page errors

  Scenario: A range on a key nobody declared is refused, with the reason
    Given I open the app
    When I search the header for "prop:terminal=190..200"
    Then the search refuses "prop:terminal=190..200" and says "nothing declares `terminal`"
    And there should be no page errors

  Scenario: The Properties file reads as an ordinary outline
    When I open the address "/_olai/Properties.olai"
    Then the node "prop-merge" is shown
    And the node "prop-merge" has the title "merge"
    And the node "prop-merge" shows the property "type" holding "ref"
    And the node "auto" is a child of "prop-merge"
    And the node "human" is a child of "prop-merge"
    And the node "prop-agent" shows the property "under" holding "agents"
    And there should be no page errors

  Scenario: A `brief` written from the board's own root opens, one directory in
    Given I open the address "/roadmap/board.olai"
    Then the property "brief" on "board-lane" is a "document" door to "/briefs/tp.md"
    When I follow the property "brief" on "board-lane"
    Then the address is "/briefs/tp.md"
    And there should be no page errors

  Scenario: A ref chip draws the variant's title, and stores the id underneath
    Given I open the address "/roadmap/board.olai"
    Then the node "board-lane" shows the property "agent" holding "Grok"
    And the property "agent" on "board-lane" is a "node" door to "/#grok"
    And "roadmap/board.olai" holds the node "board-lane" with "agent" set to "grok"
    And there should be no page errors

  Scenario: A kind a PLUGIN contributed draws no door of the app's own
    Given I open the address "/roadmap/board.olai"
    Then the node "board-lane" shows the property "run" holding "m1kb0e11-2c8d"
    And the property "run" on "board-lane" is not a link
    And there should be no page errors

  Scenario: A document's own frontmatter chips ride the same answers
    When I open the address "/briefs/tp.md"
    Then the document shows the property "agent" holding "Grok"
    And the document shows the property "worktree" holding ".worktrees/tp"
    And there should be no page errors
