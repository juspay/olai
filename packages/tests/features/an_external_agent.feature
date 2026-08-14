@scratch:chat
Feature: An agent olai did not start
  The chat panel's agent is olai's own: olai spawns it, hands it the tools, and
  draws what it says. This feature is about the other one — a coding agent in a
  terminal, in the directory, that has never heard of the web app. It reaches
  the same closed list of tools by launching `olai mcp <dir>`, and the promise
  is that the browser is not privileged: an outline edited from a terminal
  turns up on an open page the same way one edited by hand does.

  Every scenario is `@scratch:chat` — the agent writes, so the directory is a
  private copy with a server of its own — and the client is this harness
  itself (`support/mcp.ts`), speaking JSON-RPC down the pipes of the same
  nix-built binary the server came from. No model is involved: what is under
  test is the tool surface and the path from it to the disk, and a language
  model in the middle would only make that slower and less certain.

  Background:
    Given I open the app
    And I mark the page
    And a terminal agent is connected to the served directory

  Scenario: It is offered the same closed list, and no way to touch a file
    # The absences are the design: an agent that can name a byte can write a
    # broken outline, and this one has no tool that names one. `create_outline`
    # names a PATH for a new outline, not a free-form write — it is the one way
    # a brand-new file is born, and the records inside still go through the ops
    # layer's own writer.
    Then the terminal agent is offered the tool "set_done"
    And the terminal agent is offered the tool "add_node"
    And the terminal agent is offered the tool "create_outline"
    # The ledger ops. Everything the format can hold, an op can write: a
    # placement is `add_mirror`/`remove_mirror`, a dependency is `set_after`.
    # Anything missing from this list is a record only a hand edit can produce,
    # which is the practice these three exist to end.
    And the terminal agent is offered the tool "add_mirror"
    And the terminal agent is offered the tool "remove_mirror"
    And the terminal agent is offered the tool "set_after"
    And the terminal agent is offered no file tools

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
    # all. The store's watcher already handles a new `.jsonl` (see
    # it_stays_live.feature); this scenario proves the write path that mints
    # one reaches the same live tab — no reload.
    When the terminal agent creates the outline "shed.jsonl" seeded with "clear out the shed"
    Then the outline list links to "shed.jsonl"
    And the outline list has 2 entries
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal captures a node and it appears in the tree
    When the terminal agent captures "water the plants" in "house.jsonl"
    Then the tree eventually shows a node titled "water the plants"
    And the page has not reloaded

  Scenario: A terminal starts a new outline with its contents already in it
    # The other half of "one call, or nothing". Creating an outline and filling
    # it was two calls, so a second one that refused left an EMPTY outline
    # behind — a file nobody asked for. `seed` is a whole capture now, so the
    # file and everything in it arrive together, on a page that was already
    # open.
    When the terminal agent creates the outline "shed.jsonl" holding a whole tree
    Then the outline list links to "shed.jsonl"
    And the terminal agent was told it captured 3 nodes
    When I open the outline "shed.jsonl"
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
    When the terminal agent mirrors "kitchen" at the top of "house.jsonl" as "now-kitchen"
    Then the node "now-kitchen" is shown
    And the node "order" is a child of "now-kitchen"
    And the node "install" is a child of "now-kitchen"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal retires a mirror and only the placement goes
    # The other half, and the semantic worth pinning end to end: retiring a
    # placement deletes ONE LINE. The row goes, and the node it was showing is
    # still there in the outline that defines it, with its subtree.
    When the terminal agent mirrors "kitchen" at the top of "house.jsonl" as "now-kitchen"
    Then the node "now-kitchen" is shown
    When the terminal agent retires the mirror "now-kitchen"
    Then the node "now-kitchen" is not shown
    And the node "order" is a child of "kitchen"
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
    And the page has not reloaded
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
    When the terminal agent creates the document "plan.md" holding "# Plan"
    Then the documents listed are "plan.md"
    When I click the document "plan.md"
    And the terminal agent rewrites "plan.md" expecting "# Plan", as "# Plan Dig **here** first."
    Then the document renders bold text "here"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal's stale document write is refused in words
    # The conflict story on the agent's face: `was` said what the terminal
    # READ, the file says something else, and the answer is a refusal carrying
    # its kind — never a silent clobber of words nobody saw.
    When the terminal agent creates the document "plan.md" holding "# Plan"
    And the terminal agent tries to rewrite "plan.md" expecting "an older reading", as "clobber"
    Then the terminal agent was refused with the kind "usage"

  Scenario: A refused write is an answer, not a protocol error
    # Nothing in the set declares `nowhere`. The refusal reaches the agent as a
    # tool RESULT carrying its kind as data — a JSON-RPC error would be the
    # server saying it could not process the call, which is not what happened.
    When the terminal agent tries to mark "nowhere" done
    Then the terminal agent was refused with the kind "not-found"

  Scenario: Marking a branch tells the agent what is still open under it
    # A mark is a stored fact on any node, so this lands — and the answer says
    # what the rollup noticed, because "done over an unfinished task" is worth
    # knowing and is not worth refusing. Advice, in the answer to a write that
    # happened.
    When the terminal agent marks "kitchen" done
    Then node "kitchen" is done
    And the terminal agent was told "install the cabinets"

  Scenario: It reads the outlines as nodes, with file and line
    # A hit says where it is, so the agent can act on it without ever reading
    # the file it came out of.
    When the terminal agent searches for "cabinets"
    Then the terminal agent found "order" in "house.jsonl"

  Scenario: It gets the same grammar a person filters a page with
    # HACKING.md's consistency rule, at the one seam a query language could
    # break it: `is:done` is `@olai/format`'s one matcher, so the agent's
    # answer and the browser's filter cannot mean different things by it — and
    # `under` is the scoping a person gets by filtering a zoomed page, said out
    # loud so the agent can ask the same question rather than a wider one.
    When the terminal agent searches for "is:done"
    Then the terminal agent found exactly "demo"
    When the terminal agent searches for "-is:done cabinets"
    Then the terminal agent found exactly "order, install"
    When the terminal agent searches for "cabinets" under "install"
    Then the terminal agent found exactly "install"

  Scenario: An operator it gets wrong is refused with the reason, not with silence
    # The fourth door onto the same grammar, and the one where silence is
    # cheapest to ship: a tool that answered `is:blocked` with an empty `hits`
    # and nothing else would leave a model to guess whether the directory is
    # empty or the query is wrong. The refusal rides the answer.
    When the terminal agent searches for "is:blocked"
    Then the terminal agent found exactly ""
    And the terminal agent was refused "is:blocked" and told "done, doing, todo, marked, archived"
    # AS TYPED — an answer that echoed the folded token back would be quoting
    # the caller wrongly.
    When the terminal agent searches for "is:BLOCKED"
    Then the terminal agent was refused "is:BLOCKED" and told "done, doing, todo, marked, archived"
    # ...and a query it CAN read carries no refusal at all.
    When the terminal agent searches for "cabinets"
    Then the terminal agent was refused nothing
