@share-scratch
@scratch:typed
Feature: A property key that declares its type
  A property value is any string, and nothing refuses a sloppy one — unless the
  vault has DECLARED what that key holds. Declarations are an outline like any
  other, `_olai/Properties.olai`: one node per key, the title IS the key, the
  type in that node's own props, and an enum's variants are its children
  (docs/format.md).

  Then the write gate refuses a value that does not fit, in the same words
  wherever the write came from — and this is the person's door onto that: the
  chip editor commits a `set_prop` at the same gate an agent's does, so a typed
  refusal has to arrive HERE, in full, rather than as a value that quietly went
  back to what it was.

  And the reading side: a key declared `int` or `date` compares, so `..` becomes
  honest and `prop:records=190..200` is a question the header box can answer
  (docs/search.md). A range on a key nobody declared is refused with the reason,
  because comparing text as if it were a number is the lie types exist to
  prevent.

  `@scratch:` because these write the directory they are served. They share one
  copy per worker (`@share-scratch`); the corpus is restored between scenarios.

  # ── the chip seam ────────────────────────────────────────────────────

  Scenario: A typed refusal lands in the chip run, in the ops layer's own words
    # THE POINT OF THE WHOLE SEAM. `merge` is `auto` or `human` and nothing
    # else, and the sentence that says so is the refusal's — a face that
    # paraphrased it would be one that threw the answer away and kept the
    # failure.
    Given I open the outline "lanes.olai"
    And I mark the page
    When I edit the property "merge" on "chips"
    And I type "AUTO: grok review folded + CI green" into the property editor on "chips"
    Then the property editor on "chips" is closed
    And the node "chips" refuses the property write with "`merge` is `auto` | `human`"
    # ...and nothing was written: the row and the file both still say what they
    # said, which is what makes this a refusal rather than a revert.
    And the node "chips" shows the property "merge" holding "auto"
    And "lanes.olai" holds the node "chips" with "merge" set to "auto"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The refusal offers the variant a value is a typo of
    # `agent` points at a roster that lives elsewhere, so the valid values are
    # whatever nodes are under it right now — and a near miss gets the same
    # did-you-mean an unknown id has always got.
    Given I open the outline "lanes.olai"
    And I mark the page
    When I edit the property "agent" on "chips"
    And I type "clade" into the property editor on "chips"
    Then the node "chips" refuses the property write with "did you mean `claude`?"
    And the node "chips" shows the property "agent" holding "pi"
    And there should be no page errors

  Scenario: A value that FITS lands, and lands as the one stored spelling
    # The other half of the same gate, and the half a refusal test alone would
    # let rot: `2026-8-30` is what somebody types and `2026-08-30` is what the
    # vault holds, because one name has one spelling.
    Given I open the outline "lanes.olai"
    And I mark the page
    When I edit the property "dispatched" on "chips"
    And I type "2026-8-30" into the property editor on "chips"
    Then the node "chips" shows the property "dispatched" holding "2026-08-30"
    And "lanes.olai" holds the node "chips" with "dispatched" set to "2026-08-30"
    # One gesture, one commit — the Enter's own closing blur sent nothing of
    # its own, or the no-change guard would be drawing it here.
    And the node "chips" says nothing about its properties
    And there should be no page errors

  Scenario: An undeclared key on the same node still takes anything
    # Typing is OPT-IN PER KEY, and this is what that means on a screen: the
    # lane whose `pr` is fenced writes a `terminal` holding a sentence, in the
    # same run of chips, and nothing objects.
    Given I open the outline "lanes.olai"
    And I mark the page
    When I edit the property "terminal" on "far"
    And I type "a uuid, and a longer remark about it" into the property editor on "far"
    Then the node "far" shows the property "terminal" holding "a uuid, and a longer remark about it"
    And "lanes.olai" holds the node "far" with "terminal" set to "a uuid, and a longer remark about it"
    And there should be no page errors

  # ── the reading side ─────────────────────────────────────────────────

  Scenario: A span on an int key answers, and compares as a number
    # `prop:records=190..200` is the query the whole feature is named after. The
    # lane at 1000 is the one that proves the comparison: as TEXT, "1000" sorts
    # inside "190".."200", and this is why declaring the key was worth doing.
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
    # The silent-nothing this refusal exists to prevent: read as an equality,
    # `terminal=190..200` selects no node and says nothing about why.
    Given I open the app
    When I search the header for "prop:terminal=190..200"
    Then the search refuses "prop:terminal=190..200" and says "nothing declares `terminal`"
    And there should be no page errors

  # ── the declarations are an outline ──────────────────────────────────

  Scenario: The Properties file reads as an ordinary outline
    # DATA, NOT CONFIG, and this is what that buys: the vocabulary is a page
    # somebody can open, read and edit, with the variants as the children they
    # are — no config file, no restart, no second format to learn.
    When I open the address "/_olai/Properties.olai"
    Then the node "prop-merge" is shown
    And the node "prop-merge" has the title "merge"
    And the node "prop-merge" shows the property "type" holding "ref"
    And the node "auto" is a child of "prop-merge"
    And the node "human" is a child of "prop-merge"
    And the node "prop-agent" shows the property "under" holding "agents"
    And there should be no page errors
