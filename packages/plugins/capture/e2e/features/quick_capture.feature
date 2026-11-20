@scratch:good @share-scratch
Feature: A line captured from a terminal arrives on the page
  `olai surface capture add` is the door now. It speaks MCP over HTTP to the `/mcp`
  the server already serves — the same protocol, the same path and the same
  admission rule as any bridged agent — and sends the same `capture` verb an
  agent sends. There is no second face and nothing was widened for it. The
  bespoke `POST /capture` it replaced is gone.

  `--url` is required on every call and there is no fallback of any kind. That
  is the feature, not an inconvenience: the design this replaced walked to a
  per-user socket path both ends agreed on because neither chose it, and a
  capture meant for one vault landed in another and answered exactly like a
  capture that had not.

  What the verb itself promises is asserted where it lives: which file a capture
  lands in, what it refuses, what the record holds (`@olai/format`'s
  `inbox.test.ts` for the composition, `@olai/server`'s `mcp/tools.test.ts` for
  the tool end to end). Nothing here re-asserts those.

  What is asserted HERE is the half only this chain can answer: a line typed in
  a terminal reaches the page somebody already has open, the terminal is told
  where it went in words a person can act on, and the CLI can read back what it
  wrote.

  Captures arrive DATED, which is the point of that half — the reader was not
  looking at the inbox when it was sent, so the day's journal is where it gets
  noticed.

  `@scratch:` because a capture writes the directory it is served, and mints
  `_olai/Inbox.olai` in it — and `@share-scratch` because the restore between
  scenarios REMOVES a file the fixture does not have, which is exactly what a
  minted inbox is. So the whole feature costs one server rather than four, and
  the first line of every scenario ("no Inbox") is what proves the restore took.

  Scenario: A capture from a terminal reaches the page somebody already has open
    Given I open the outline "house.olai"
    And the sidebar offers no Inbox
    When I capture "look into the new cabinets" from a terminal
    Then the sidebar offers the Inbox
    And the Inbox wears a count of 1
    And there should be no page errors

  Scenario: …and the terminal is told which vault it landed in, and where
    Given I open the outline "house.olai"
    When I capture "buy the handles" from a terminal
    Then the terminal was told it captured into the served directory
    And the terminal was given a link to the row
    And there should be no page errors

  Scenario: …and `--json` gives the whole answer instead, for a script
    Given I open the outline "house.olai"
    When I capture "sand the shelf" from a terminal, asking for JSON
    Then the terminal was given the whole record, naming the vault
    And there should be no page errors

  Scenario: …and the terminal can read back what it just wrote
    Given I open the outline "house.olai"
    When I capture "fit the hinges" from a terminal
    Then reading "_olai/Inbox.olai" from a terminal shows "fit the hinges"
    And there should be no page errors

  Scenario: …and lands on today, because nobody was looking at the inbox
    Given I open today
    When I capture "call the electrician" from a terminal, asking for JSON
    Then what was captured is on today
    And there should be no page errors

  Scenario: A capture cannot say who made it, and cannot guess where to go
    Given I open the outline "house.olai"
    Then capturing while claiming "captured-by" is not something this door takes
    And capturing without saying which server is refused before anything is sent
    And the sidebar offers no Inbox
    And there should be no page errors
