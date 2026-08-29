@scratch:chat
Feature: An agent olai did not start
  The chat panel's agent is olai's own: olai spawns it, hands it the tools, and
  draws what it says. This feature is about the other one — a coding agent in a
  terminal, in the directory, that has never heard of the web app. It reaches
  the same closed list of tools by POSTing at the running server's `/mcp`,
  and the promise is that the browser is not privileged: an outline edited
  from a terminal turns up on an open page the same way one edited by hand
  does. One store, one process — the page follows because the write went
  through the same ops layer the keyboard does, not because a second olai
  happened to be watching the same files.

  Every scenario is `@scratch:chat` — the agent writes, so the directory is a
  private copy with a server of its own — and the client is this harness
  itself (`support/mcp.ts`), speaking JSON-RPC at that server's `/mcp`. No
  model is involved: what is under test is the tool surface and the path from
  it to the disk, and a language model in the middle would only make that
  slower and less certain.

  Background:
    Given I open the app
    And I mark the page
    And a terminal agent is connected to the served directory

  Scenario: A terminal marks something done and the open page follows
    # The item's whole claim. Two processes, one directory: the agent writes
    # through the ops layer, the server's watcher sees the file move, and the
    # checkbox in front of a person who is not in that terminal moves too.
    When the terminal agent marks "order" done
    Then node "order" is done
    And the page has not reloaded
    And there should be no page errors

  Scenario: What a terminal marks done turns up on today
    # The two halves of "every date counts", end to end and in one sentence:
    # the ops layer stamps the mark with the INSTANT it was made — never a bare
    # `true`, never a day with no time — and the journal reads the dates on
    # marks as well as the `date` field. So finishing something puts it on
    # today's page and lights today in the calendar, with nothing scheduled and
    # nothing else written. Nothing in this fixture is dated this century, so
    # today is empty until the write lands.
    When the terminal agent marks "order" done
    Then node "order" is done
    When I open today
    Then the day lists "order"
    And today has something on it
    And there should be no page errors

  Scenario: A terminal starts a new outline and the open page lists it
    # The gap `create_outline` closes: `add_node` refuses any file the set does
    # not already hold, so without this an agent cannot open a fresh outline at
    # all. The store's watcher already handles a new `.olai` (see
    # it_stays_live.feature); this scenario proves the write path that mints
    # one reaches the same live tab — no reload.
    #
    # THREE, and the number is a fact about the FIXTURE, not the claim: the
    # claim is "one more than the corpus held", and this corpus now ships TWO
    # outlines on purpose — `house.olai`, plus `yard.olai`, which
    # node_context.feature pins the cross-outline landing against — so the one
    # write is the one that turns it into three.
    When the terminal agent creates the outline "shed.olai" seeded with "clear out the shed"
    Then the outline list links to "shed.olai"
    And the outline list has 3 entries
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal captures a node and it appears in the tree
    When the terminal agent captures "water the plants" in "house.olai"
    Then the tree eventually shows a node titled "water the plants"
    And the page has not reloaded

  Scenario: A terminal starts a new outline with its contents already in it
    # The other half of "one call, or nothing". Creating an outline and filling
    # it was two calls, so a second one that refused left an EMPTY outline
    # behind — a file nobody asked for. `seed` is a whole capture now, so the
    # file and everything in it arrive together, on a page that was already
    # open.
    When the terminal agent creates the outline "shed.olai" holding a whole tree
    Then the outline list links to "shed.olai"
    And the terminal agent was told it captured 3 nodes
    When I open the outline "shed.olai"
    Then the node "clear" is a child of "shed"
    And the node "tins" is a child of "clear"
    And the node "clear" shows an empty checkbox
    And there should be no page errors

  Scenario: A terminal captures a whole subtree in one call
    # The item this was filed from: an agent capturing a house outline issued
    # one add_node per node — thirteen calls, each riding the full write gate,
    # and a failure partway through leaving half a subtree behind. `children`
    # makes it one call: one plan, one validation, one atomic rename, one
    # commit. So the page does not watch a tree grow a row at a time; it gets
    # the whole thing in the next snapshot.
    When the terminal agent captures a pantry and everything in it, in one call
    Then the tree shows the whole captured subtree at once
    And the node "shelves" is a child of "pantry"
    And the node "measure" is a child of "shelves"
    # The marks arrive with the nodes, written as the mark tools write them:
    # `todo` is an empty box, and `done` is stamped with the instant.
    And the node "measure" shows an empty checkbox
    And the node "paint" shows a checked checkbox
    And the terminal agent was told it captured 4 nodes
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal places a mirror and the open page draws what it shows
    # A mirror is a second PLACEMENT of a node that already exists, and the
    # claim is that the page expands it in place: the row the agent wrote
    # carries no title of its own, and everything under `kitchen` is drawn
    # beneath it. Nothing was copied — there is one `order` on disk and two on
    # screen.
    When the terminal agent mirrors "kitchen" at the top of "house.olai" as "now-kitchen"
    Then the node "now-kitchen" is shown
    And the node "order" is a child of "now-kitchen"
    And the node "install" is a child of "now-kitchen"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal retires a mirror and only the placement goes
    # The other half, and the semantic worth pinning end to end: retiring a
    # placement deletes ONE LINE. The row goes, and the node it was showing is
    # still there in the outline that defines it, with its subtree.
    When the terminal agent mirrors "kitchen" at the top of "house.olai" as "now-kitchen"
    Then the node "now-kitchen" is shown
    When the terminal agent retires the mirror "now-kitchen"
    Then the node "now-kitchen" is not shown
    And the node "order" is a child of "kitchen"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal duplicates a subtree and the page draws the copy beside it
    # HACKING.md's parity rule on this PR's op: `duplicate_node` is the same
    # request the row menu's `Duplicate` and ⌘⇧D send, so what an agent gets is
    # what a person gets — a second subtree, one row below, sharing no id with
    # the first. The page follows because the write went through the one ops
    # layer, not because anything was echoed.
    When the terminal agent duplicates "install"
    Then the terminal agent was told it captured 3 nodes
    And the copy of "install" in "house.olai" repeats every field but the ids and the stamps
    And "house.olai" holds a copy of "install" with fresh ids throughout
    And the tree eventually shows a node titled "install the cabinets"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal wires a dependency and the page draws what is waiting
    # `set_after` writes the ordering edge, and blockedness is DERIVED from it
    # together with the MARKS — which is why the agent marks first: an unmarked
    # node is a bullet rather than unstarted work, so an edge onto one holds
    # nothing up. Once `order` is a task, `install` (under way) is waiting on
    # it. The arrow is written from the node that waits, which is the one
    # spelling the ops layer has.
    Given the node "install" is not blocked
    When the terminal agent marks "order" todo
    And the terminal agent makes "install" wait on "order"
    Then the node "install" is blocked by "order"
    # And the same derivation is a QUESTION it can ask. `is:blocked` is the one
    # operator that reads what the app DRAWS rather than what the record
    # carries, so the arrow just written answers a search a turn later — no
    # re-reading of `after` and no second definition of what waiting means.
    When the terminal agent searches for "is:blocked"
    Then the terminal agent found exactly "#install"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal reads a whole outline in one call
    # The read side catching up with the write side. `add_node` takes a whole
    # nested capture and `apply` a run of verbs, so a subtree is ONE write —
    # but an outline of N top-level roots had no single-call read at all:
    # `list_outlines` named the roots and `read_subtree` took an id, so reading
    # a file whole was one call per root. Here the agent gives the outline a
    # second root and then reads the file: both come back, walked, in one
    # answer.
    #
    # It writes the PLACEMENT too, rather than leaning on the corpus, because
    # the corpus has none — a mirror at the top level of a file is exactly the
    # row this read must not call a root, and a scenario that asserted the
    # exclusion over a file with nothing to exclude would be a check that
    # passes for the wrong reason. The write is this scratch copy's own, so no
    # other scenario reads a fixture grown for this one.
    When the terminal agent captures "sort the bills" in "house.olai"
    Then the tree eventually shows a node titled "sort the bills"
    When the terminal agent mirrors "order" at the top of "house.olai" as "now-order"
    Then the node "now-order" is shown
    When the terminal agent reads the whole outline "house.olai"
    # Two roots and no third: the placement occupies a place in the file and is
    # not something the file HOLDS, which is the same rule that keeps the walk
    # from descending into one.
    Then the terminal agent was handed the roots "kitchen remodel #home, sort the bills"
    And there should be no page errors

  Scenario: A mistyped outline path is refused with the closest one
    # Refused, never answered empty: an outline that holds nothing and an
    # outline that is not there look identical to a caller, and only one of
    # them is worth acting on. The sentence is `read_document`'s own — one
    # typo, one answer, whichever verb it was typed at.
    When the terminal agent reads the whole outline "hause.olai"
    Then the terminal agent was refused with the kind "not-found"
    And the terminal agent was pointed at "house.olai"
    And there should be no page errors

  Scenario: A selection arrives with its notes
    # The other half of the same item: a hit carries every field of the record
    # except the note, and the note is the one you have to ask for — so "read
    # every one of these with what was written under it" is one call rather
    # than one call and a `read_node` per row.
    When the terminal agent searches for "hinges" with the notes
    Then the terminal agent found exactly "#hinges"
    And the terminal agent was handed the note "brass, if the budget survives"
    And there should be no page errors

  Scenario: A node read carries the parent's id
    # `path` is titles. Every write that names a parent takes an id. A caller
    # that can see "install the cabinets" and not `install` cannot file a
    # sibling without a second guess — which is the 2026-08-28 incident.
    When the terminal agent reads the node "hinges"
    Then the terminal agent was handed the parent "install"
    And there should be no page errors

  Scenario: A subtree can be walked without the notes
    # Depth bounds levels, not prose. The same outline with its notes is the
    # expensive read; `withDesc: false` is the table of contents — ids, titles,
    # marks, structure. `hinges` in this fixture carries a note, so a walk that
    # kept it would fail the absence below for the wrong reason.
    When the terminal agent reads the whole outline "house.olai" without the notes
    Then the terminal agent was handed the roots "kitchen remodel #home"
    And no node in the answer carries a note
    And there should be no page errors

  Scenario: A terminal writes a document, both faces of one gate
    # The consistency rule, end to end: `create_document` mints the file and
    # `write_document` replaces its text — the same two ops the browser's
    # editor sends — and a page that never heard of the terminal follows,
    # sidebar and rendered body both, with no reload.
    # At the ROOT rather than in a fresh subdirectory: a directory born
    # mid-serve is watched only from the next probe, so a rewrite inside one
    # reaches the page on the backstop — real, and too slow for a scenario
    # whose subject is the write path, not watcher latency.
    # The document the corpus already holds is named with it, in the sidebar's
    # own order: what is asserted is the directory's MEMBERSHIP after the
    # write, and a list of one would be a claim about the fixture rather than
    # about the write. `notes/cabinets.md` is in the corpus too and is NOT
    # here, because folders start collapsed (`client/fold/folders.ts`) and a
    # row nobody has opened is not drawn.
    When the terminal agent creates the document "plan.md" holding "# Plan"
    Then the documents listed are "finishes.md, plan.md"
    When I click the document "plan.md"
    And the terminal agent rewrites "plan.md" expecting "# Plan", as "# Plan Dig **here** first."
    Then the document renders bold text "here"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A saved page's body is still handed to the reader that asks for one
    # THE OTHER SIDE OF THE PREVIEW'S DIET. A `.html` under an open page stopped
    # crossing the websocket, because the page draws a frame that fetches the
    # file over HTTP and what it needs from the wire is only the file's
    # revision. That is a change to what ONE reader asks for, and this is what
    # says it was only that: an agent has no frame, so the door it reads a body
    # through has to go on answering with the file.
    #
    # It is the same collection and the same key the browser subscribes to,
    # reached the way a `.mcp.json` client reaches it.
    When I rewrite "quote.html" as:
      """
      <h1>Quote</h1>
      <p>the joiner invoiced for the cabinets</p>
      """
    And the terminal agent reads the file "quote.html"
    Then the terminal agent was handed "the joiner invoiced for the cabinets"

  Scenario: A terminal runs three ops as one write and the page sees one snapshot
    # `olai-batch-verbs`. A loop of three calls is three revisions, and a tab
    # would draw the row, then the edge, then the property. One `apply` is one
    # plan, one validation, one atomic rename and one publication — so the page
    # that has the new row has everything the batch said about it.
    When the terminal agent applies three ops in one call
    Then the node "worktop" is a child of "kitchen"
    And the terminal agent was told it captured 1 nodes
    And the page has not reloaded
    And there should be no page errors

  Scenario: A batch refused at its last op writes nothing at all
    # The property a caller cannot build out of a loop: the seventh call
    # refusing leaves six on disk with nothing to say which six. Here the first
    # two ops are perfectly good and neither of them happens.
    When the terminal agent applies a batch whose last op is refused
    Then the terminal agent was refused with the kind "not-found"
    And the node "never" is not shown
    And the node "order" is a child of "kitchen"
    And there should be no page errors

  Scenario: A terminal writes three fields of one node in one call
    # `update` is the narrow half of the same pair: one node, several facts,
    # one write — where a title, a note and a property used to be three.
    When the terminal agent updates "order" in one call
    Then the node "order" is a child of "kitchen"
    And the page has not reloaded
    And there should be no page errors
