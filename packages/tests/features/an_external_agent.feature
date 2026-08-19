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
    # all. The store's watcher already handles a new `.olai` (see
    # it_stays_live.feature); this scenario proves the write path that mints
    # one reaches the same live tab — no reload.
    When the terminal agent creates the outline "shed.olai" seeded with "clear out the shed"
    Then the outline list links to "shed.olai"
    And the outline list has 2 entries
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

  Scenario: A placement is not a node, and duplicating one says which node to name
    # The refusal every op that names a node makes, in the same words — so an
    # agent that reached for a mirror is told what to reach for instead rather
    # than quietly copying a subtree in a file nobody asked about.
    When the terminal agent mirrors "kitchen" at the top of "house.olai" as "now-kitchen"
    And the terminal agent tries to duplicate "now-kitchen"
    Then the terminal agent was refused with the kind "usage"
    And the terminal agent was refused, saying "`now-kitchen` is a mirror — a second placement of `kitchen`, not a node of its own. Name `kitchen` instead."
    And "house.olai" holds exactly 1 node titled "kitchen remodel #home"

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

  Scenario: A terminal finds the documents and reads one back
    # The read half of the same gate, and the half that did not exist: the
    # write verbs have always taken a `was` — the text the caller read — and
    # until `list_documents` and `read_document` there was no tool that could
    # hand an agent that text. So an agent could mint a `.md` it could never
    # read and rewrite one it had never seen.
    # The listing is the map, exactly as `list_outlines` is: every served
    # `.md` with the line it opens with, the ones in folders included — a path
    # an agent can hand straight back to a read or a write. (What is NOT in it
    # is a `.html`: the app shows those and the set keeps no body for one, so
    # there is nothing to read back. This corpus holds none, so that exclusion
    # is pinned where a `.html` exists — `server/src/mcp/tools.test.ts`.)
    When the terminal agent lists the documents
    Then the terminal agent was shown the document "finishes.md" titled "Finishes"
    And the terminal agent was shown the document "notes/cabinets.md" titled "Cabinets"
    # And the body is the body — verbatim, out of the same snapshot the page
    # renders from, which is what makes it a thing a write can be judged
    # against.
    When the terminal agent reads the document "finishes.md"
    Then the terminal agent was handed the document text "Matte black handles, oak counters"
    # A path that is not one is REFUSED, in the voice every other tool refuses
    # in: the kind as data, and the near miss in the sentence — the same near
    # miss `write_document` gives for the same typo, because one path typed
    # wrongly should not be answered two different ways.
    When the terminal agent tries to read the document "finishs.md"
    Then the terminal agent was refused with the kind "not-found"
    And the terminal agent was refused, saying "did you mean `finishes.md`"
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

  Scenario: A branch cannot be marked done over what is still open under it
    # A mark is a stored fact on any node — and a `done` on a parent is a claim
    # about the whole BRANCH, because done-hiding takes the subtree with the
    # row. So this one would sweep `install the cabinets` off the page while it
    # is still under way, and it is refused as DATA: the kind travels
    # structured, the tasks are named in the sentence (`done-over-open-work`).
    When the terminal agent tries to mark "kitchen" done
    Then the terminal agent was refused with the kind "usage"
    And node "kitchen" is not done
    # And once the branch really is finished the mark lands — with the rollup's
    # remark about the row above, which is advice on a write that happened.
    When the terminal agent marks "install" done
    Then the terminal agent was told "every task under `kitchen remodel #home` is done now"
    When the terminal agent marks "kitchen" done
    Then node "kitchen" is done

  Scenario: It reads the outlines as nodes, with file and line
    # A hit says where it is, so the agent can act on it without ever reading
    # the file it came out of.
    When the terminal agent searches for "cabinets"
    Then the terminal agent found "order" in "house.olai"

  Scenario: It gets the same grammar a person filters a page with
    # HACKING.md's consistency rule, at the one seam a query language could
    # break it: `is:done` is `@olai/format`'s one matcher, so the agent's
    # answer and the browser's filter cannot mean different things by it — and
    # `under` is the scoping a person gets by filtering a zoomed page, said out
    # loud so the agent can ask the same question rather than a wider one.
    When the terminal agent searches for "is:done"
    Then the terminal agent found exactly "#demo"
    When the terminal agent searches for "-is:done cabinets"
    # THE DOCUMENT LEADS, and that is the ranking rather than a kind winning:
    # `notes/cabinets.md` is CALLED Cabinets, so the word starts its title,
    # where the two records only carry it in the middle of theirs. A negated
    # clause is satisfied by a document — it is indeed not done — which is the
    # other half of what a `.md` can answer (docs/search.md).
    Then the terminal agent found exactly "notes/cabinets.md, #order, #install"
    When the terminal agent searches for "cabinets" under "install"
    Then the terminal agent found exactly "#install"
    # A phrase and a group reach this door through the same one grammar, so an
    # agent can ask for the line a person quoted — and for either of two
    # things, which is the query that used to be two calls.
    When the terminal agent searches for '"the new cabinets"'
    Then the terminal agent found exactly "#order"
    When the terminal agent searches for "counters OR cabinets"
    # AND `finishes.md` LAST, which is the roadmap item closed in one line:
    # "counters" is in its PROSE and in no title, so it is the weakest kind of
    # hit there is — and until now it was no hit at all, because nothing walked
    # a body.
    Then the terminal agent found exactly "notes/cabinets.md, #order, #install, #demo, finishes.md"
    # A group takes a CLAUSE as readily as a word, including the one whose value
    # is a word for a day — counted from the server's own clock, the one a
    # `done` is stamped with. Every date in this fixture is in the past and
    # stays there, so what this selects is the finished node plus whatever is
    # under way: `install` carries a dated `doing`, which is on no day at all,
    # and is here on the mark rather than on the date.
    When the terminal agent searches for "date:..today OR is:doing"
    Then the terminal agent found exactly "#install, #demo"

  Scenario: An operator it gets wrong is refused with the reason, not with silence
    # The fourth door onto the same grammar, and the one where silence is
    # cheapest to ship: a tool that answered `is:open` with an empty `hits`
    # and nothing else would leave a model to guess whether the directory is
    # empty or the query is wrong. The refusal rides the answer.
    When the terminal agent searches for "is:open"
    Then the terminal agent found exactly ""
    And the terminal agent was refused "is:open" and told "done, doing, todo, marked, blocked, mirrored, trashed"
    # AS TYPED — an answer that echoed the folded token back would be quoting
    # the caller wrongly.
    When the terminal agent searches for "is:OPEN"
    Then the terminal agent was refused "is:OPEN" and told "done, doing, todo, marked, blocked, mirrored, trashed"
    # ...and the same contract on the refusal that is a QUOTE rather than an
    # operator, where "as typed" is the whole of what an agent has to echo back
    # to a person: capitals and opening quote both survive the trip.
    When the terminal agent searches for '"The New'
    Then the terminal agent found exactly ""
    And the terminal agent was refused '"The New' and told "a phrase runs from one"
    # An empty phrase is refused rather than answered with the directory.
    When the terminal agent searches for '""'
    Then the terminal agent was refused '""' and told "no words in it"
    # ...and a query it CAN read carries no refusal at all.
    When the terminal agent searches for "cabinets"
    Then the terminal agent was refused nothing

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
