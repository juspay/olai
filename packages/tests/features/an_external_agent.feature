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
