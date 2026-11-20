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
    And I show the done nodes
    And I mark the page
    And a terminal agent is connected to the served directory

  Scenario: A terminal marks something done and the open page follows
    When the terminal agent marks "order" done
    Then node "order" is done
    And the page has not reloaded
    And there should be no page errors

  Scenario: What a terminal marks done turns up on today
    When the terminal agent marks "order" done
    Then node "order" is done
    When I open today
    Then the day lists "order"
    And today has something on it
    And there should be no page errors

  Scenario: A terminal starts a new outline and the open page lists it
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
    When the terminal agent creates the outline "shed.olai" holding a whole tree
    Then the outline list links to "shed.olai"
    And the terminal agent was told it captured 3 nodes
    When I open the outline "shed.olai"
    Then the node "clear" is a child of "shed"
    And the node "tins" is a child of "clear"
    And the node "clear" shows an empty checkbox
    And there should be no page errors

  Scenario: A terminal captures a whole subtree in one call
    When the terminal agent captures a pantry and everything in it, in one call
    Then the tree shows the whole captured subtree at once
    And I show the done nodes
    And the node "shelves" is a child of "pantry"
    And the node "measure" is a child of "shelves"
    And the node "measure" shows an empty checkbox
    And the node "paint" shows a checked checkbox
    And the terminal agent was told it captured 4 nodes
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal places a mirror and the open page draws what it shows
    When the terminal agent mirrors "kitchen" at the top of "house.olai" as "now-kitchen"
    Then the node "now-kitchen" is shown
    And the node "order" is a child of "now-kitchen"
    And the node "install" is a child of "now-kitchen"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal retires a mirror and only the placement goes
    When the terminal agent mirrors "kitchen" at the top of "house.olai" as "now-kitchen"
    Then the node "now-kitchen" is shown
    When the terminal agent retires the mirror "now-kitchen"
    Then the node "now-kitchen" is not shown
    And the node "order" is a child of "kitchen"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal duplicates a subtree and the page draws the copy beside it
    When the terminal agent duplicates "install"
    Then the terminal agent was told it captured 3 nodes
    And the copy of "install" in "house.olai" repeats every field but the ids and the stamps
    And "house.olai" holds a copy of "install" with fresh ids throughout
    And the tree eventually shows a node titled "install the cabinets"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal wires a dependency and the page draws what is waiting
    Given the node "install" is not blocked
    When the terminal agent marks "order" todo
    And the terminal agent makes "install" wait on "order"
    Then the node "install" is blocked by "order"
    When the terminal agent searches for "is:blocked"
    Then the terminal agent found exactly "#install"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A terminal reads a whole outline in one call
    When the terminal agent captures "sort the bills" in "house.olai"
    Then the tree eventually shows a node titled "sort the bills"
    When the terminal agent mirrors "order" at the top of "house.olai" as "now-order"
    Then the node "now-order" is shown
    When the terminal agent reads the whole outline "house.olai"
    Then the terminal agent was handed the roots "kitchen remodel #home, sort the bills"
    And the terminal agent was handed the placements "now-order"
    And there should be no page errors

  Scenario: A terminal shapes the walk to its question, and a bad name is refused
    When the terminal agent walks "kitchen" with only the fields "title, status, done"
    Then every row of the walk carries exactly title, status, done
    And the walk's structure is the tree's own
    When the terminal agent walks "kitchen" one level deep with only the fields "status"
    Then every row of the shallow walk carries exactly status
    And the row "install" in the shallow walk is said truncated
    When the terminal agent reads "kitchen" with the children shaped as "status"
    Then the node arrived whole and its children carry exactly status
    When the terminal agent walks "kitchen" with only the fields "status, props"
    Then the terminal agent was refused with the kind "usage"
    And the refusal lists every legal field name
    When the terminal agent walks "kitchen" with the fields "desc" and the notes turned off
    Then the terminal agent was refused with the kind "usage"
    And there should be no page errors

  Scenario: A mistyped outline path is refused with the closest one
    When the terminal agent reads the whole outline "hause.olai"
    Then the terminal agent was refused with the kind "not-found"
    And the terminal agent was pointed at "house.olai"
    And there should be no page errors

  Scenario: A selection arrives with its notes
    When the terminal agent searches for "hinges" with the notes
    Then the terminal agent found exactly "#hinges"
    And the terminal agent was handed the note "brass, if the budget survives"
    And there should be no page errors

  Scenario: A node read carries the parent's id
    When the terminal agent reads the node "hinges"
    Then the terminal agent was handed the parent "install"
    And there should be no page errors

  Scenario: A subtree can be walked without the notes
    When the terminal agent reads the whole outline "house.olai" without the notes
    Then the terminal agent was handed the roots "kitchen remodel #home"
    And no node in the answer carries a note
    And there should be no page errors

  Scenario: A terminal writes a document, both faces of one gate
    When the terminal agent creates the document "plan.md" holding "# Plan"
    When I expand the reference section
    Then the documents listed are "finishes.md, plan.md"
    When I click the document "plan.md"
    And the terminal agent rewrites "plan.md" expecting "# Plan", as "# Plan Dig **here** first."
    Then the document renders bold text "here"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A saved page's body is browser-only
    When the terminal agent asks to read the fetched file "quote.html"
    Then the terminal agent cannot read a fetched body

  Scenario: A terminal runs three ops as one write and the page sees one snapshot
    When the terminal agent applies three ops in one call
    Then the node "worktop" is a child of "kitchen"
    And the terminal agent was told it captured 1 nodes
    And the page has not reloaded
    And there should be no page errors

  Scenario: A batch refused at its last op writes nothing at all
    When the terminal agent applies a batch whose last op is refused
    Then the terminal agent was refused with the kind "not-found"
    And the node "never" is not shown
    And the node "order" is a child of "kitchen"
    And there should be no page errors

  Scenario: A terminal writes three fields of one node in one call
    When the terminal agent updates "order" in one call
    Then the node "order" is a child of "kitchen"
    And the page has not reloaded
    And there should be no page errors

  @kolu
  Scenario: A foreign tool keeps its adapter title without an outline story
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "external kolu outlines_done {}"
    Then the agent is idle
    And the chat shows a tool call named "mcp__kolu__outlines_done"
    And the tool call shows no outline
    And the chat shows no story under the call
    And the agent's answer mentions "foreign write-shaped reply"
    When I unfold the tool call
    Then the foreign tool reply remains ordinary detail

  Scenario: A kolu that reached no daemon refuses EVERY call, and the next init says so
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "external kolu outlines_done {}"
    Then the agent is idle
    And the chat shows a tool call named "mcp__kolu__outlines_done"
    And the chat shows a failed tool call
    When I unfold the tool call
    Then the tool call's detail mentions "padi transport down"
    When I ask the agent "hello"
    Then the agent is idle
    And the panel says the agent could not attach "kolu"
    And the reason it gives for "kolu" is "failed"
    And there should be no page errors
