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

  And the DISPLAY side, which is the same declaration read by the other arm: a
  declared value NAMES something, and one place answers what — the gate and the
  chip cannot disagree about the same string (`@olai/format`'s `meaning.ts`).
  So a `doc` key whose row says `base: root` resolves from the served root
  wherever it was written, a `ref` chip draws the variant's title over the id it
  stores, and a `path` that points outside this directory draws no door at all.

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
    # said, which is what makes this a refusal rather than a revert. The row
    # says it as the variant's TITLE and the file says it as the stored id,
    # which is the ref chip's own rule and is why these two lines differ.
    And the node "chips" shows the property "merge" holding "automatic"
    And "lanes.olai" holds the node "chips" with "merge" set to "auto"
    And the page has not reloaded
    # ONE GESTURE, ONE REFUSAL — the refusal is the one send's own answer; the
    # stand-down swallows the duplicate and never the answer. Argued, not
    # re-asserted (Opus, review 2 of 2): a second send of the same miss is
    # refused from the UNCHANGED snapshot and draws the very same words
    # through `createSaying`'s replace — one DOM line either way, so any
    # assertion of the claim here could only ever rent the line's 6-second
    # expiry against a loaded box; it could not go red for one send vs two.
    # The claim's red-able venues hold it instead: the FITS scenario's silence
    # pin below, and the `sent` log in `editor.test.ts`.
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
    # The same one gesture, one refusal — argued at the first scenario; the
    # words above are the pin this venue can hold, and the send count is the
    # unit file's half.
    And there should be no page errors

  Scenario: A moved key refuses before the typed gate's work is spent — one gesture, one refusal
    # THE COMPOSITION of the two gates the chip's commit now passes. Two
    # refusals are reachable from ONE commit here — the value does not fit
    # what `merge` declares AND its `was` has gone stale — and one gesture
    # gets ONE answer: the CONDITION is judged first, because a premise that
    # moved voids the write whole, where a value that does not fit is a fact
    # about the payload either way. The typed sentence never draws.
    Given I open the outline "lanes.olai"
    And I mark the page
    When I edit the property "merge" on "chips"
    And I type "AUTO: grok review folded + CI green" into the property editor on "chips" without pressing Enter
    # ...and now somebody else moves the key mid-edit: the chip stays (the
    # lane still has a `merge`), and the open box is not the frame's business.
    # The marker on `far` is the ordering the Enter owes the gate: the one
    # republish that answers it is the parse that moved `merge`.
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
    # ONE answer, and it is the CONDITION's — the value's unfitness never
    # spent the typed gate at all.
    And the node "chips" refuses the property write with "it now says `human`"
    # ...and nothing was written, either way: the row and the file say what
    # the agent said.
    And the node "chips" shows the property "merge" holding "human"
    And "lanes.olai" holds the node "chips" with "merge" set to "human"
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

  # ── what a declared value NAMES ──────────────────────────────────────

  Scenario: A `brief` written from the board's own root opens, one directory in
    # THE RESURRECTION. `roadmap/board.olai` writes `briefs/tp.md` the way every
    # board in every vault writes one — by a convention that stands at the root,
    # not by somebody standing in `roadmap/`. Resolved beside the writing file it
    # named `roadmap/briefs/tp.md`, which the directory does not serve, so the
    # chip drew link-coloured and inert; the vault says `base: root` on the
    # key's own row now, and the gate and the chip both read that row.
    Given I open the address "/roadmap/board.olai"
    Then the property "brief" on "board-lane" is a "document" door to "/briefs/tp.md"
    When I follow the property "brief" on "board-lane"
    Then the address is "/briefs/tp.md"
    And there should be no page errors

  Scenario: A ref chip draws the variant's title, and stores the id underneath
    # The other half of the same declaration. `agent grok` reads `agent Grok`
    # because the vault declared `agent` a reference — names rename, ids don't —
    # and the file goes on holding the id, which is what a `set_prop` takes.
    Given I open the address "/roadmap/board.olai"
    Then the node "board-lane" shows the property "agent" holding "Grok"
    And the property "agent" on "board-lane" is a "node" door to "/#grok"
    And "roadmap/board.olai" holds the node "board-lane" with "agent" set to "grok"
    And there should be no page errors

  Scenario: A `path` that points outside this directory draws no door
    # The wrong-door-is-worse-than-no-door rule, now said by the vault rather
    # than guessed at: `worktree` is declared `path`, which may point anywhere —
    # at a directory on the machine the orchestrator runs on, say — so a chip
    # that offered to open it would be offering a page that does not exist.
    Given I open the address "/roadmap/board.olai"
    Then the node "board-lane" shows the property "worktree" holding ".worktrees/board"
    And the property "worktree" on "board-lane" is not a link
    And there should be no page errors

  Scenario: A document's own frontmatter chips ride the same answers
    # ONE TABLE, and the document page is where that is worth showing: a `.md`
    # writes named facts about itself in its frontmatter, and those chips are
    # drawn by the same run out of the same reading. So the declaration reaches
    # them without anybody teaching the document page what a `ref` is.
    When I open the address "/briefs/tp.md"
    Then the document shows the property "agent" holding "Grok"
    And the document shows the property "worktree" holding ".worktrees/tp"
    And there should be no page errors
