@scratch:good @share-scratch
Feature: A line captured from a terminal arrives on the page
  `olai surface capture` is the door now. It dials the agent socket the server
  binds — a `0700` per-user path, where the mode is the gate — and sends the
  same `capture` verb an agent sends, so there is no bearer to mint and no
  header to trust. The bespoke `POST /capture` it replaced is gone.

  What the verb itself promises is asserted where it lives: which file a capture
  lands in, what it refuses, what the record holds (`@olai/format`'s
  `inbox.test.ts` for the composition, `@olai/server`'s `mcp/tools.test.ts` for
  the tool end to end). Nothing here re-asserts those.

  What is asserted HERE is the half only this chain can answer: a line typed in
  a terminal reaches the page somebody already has open, and the CLI can read
  back what it wrote.

  Captures arrive DATED, which is the point of that half — the reader was not
  looking at the inbox when it was sent, so the day's journal is where it gets
  noticed.

  `@scratch:` because a capture writes the directory it is served, and mints
  `_olai/Inbox.olai` in it — and `@share-scratch` because the restore between
  scenarios REMOVES a file the fixture does not have, which is exactly what a
  minted inbox is. So the whole feature costs one server rather than four, and
  the first line of every scenario ("no Inbox") is what proves the restore took.

  Scenario: A capture from a terminal reaches the page somebody already has open
    # Nothing is reloaded and nothing is pressed: the line is typed somewhere
    # else and the sidebar follows the disk like any other write.
    Given I open the outline "house.olai"
    And the sidebar offers no Inbox
    When I capture "look into the new cabinets" from a terminal
    Then the sidebar offers the Inbox
    And the Inbox wears a count of 1
    And there should be no page errors

  Scenario: …and the terminal can read back what it just wrote
    # The other half of a client: `olai surface get outlines <path>` reads the
    # same collection an agent reads, over the same socket the write went out
    # on — so one binary both wrote and saw it, with no browser involved.
    Given I open the outline "house.olai"
    When I capture "buy the handles" from a terminal
    Then reading "_olai/Inbox.olai" from a terminal shows "buy the handles"
    And there should be no page errors

  Scenario: …and lands on today, because nobody was looking at the inbox
    Given I open today
    When I capture "call the electrician" from a terminal
    Then what was captured is on today
    And there should be no page errors

  Scenario: A captured mail keeps a link that opens Mail, not a page of this app
    # The two riders, end to end and in a real browser: `message:` is on the
    # sanitiser's href allowlist (`markdown/sanitise.ts`), so the pointer
    # survives — and this app claims no press on it, so the browser follows the
    # href and hands the scheme to the OS.
    Given I open the outline "house.olai"
    When I capture the mail "the thread about cabinets" pointing at "message://<abc123@mail.example>" from a terminal
    And I open what was captured
    Then the note links to "message://%3Cabc123@mail.example%3E"
    And there should be no page errors
