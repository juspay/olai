@scratch:good @share-scratch
Feature: A line captured from somewhere else arrives on the page
  `POST /capture` is one HTTP door: a share sheet, a Raycast script pointed at
  Mail.app, or a `curl` in something that noticed something. Authentication is
  the tailnet in front of it — the identity header `tailscale serve` injects is
  required, and is recorded on the node as `captured-by`.

  What the endpoint itself promises is asserted over a socket against the files
  on disk (`@olai/server`'s `capture.test.ts`). What is asserted HERE is the
  half only a browser can answer: a line sent from a phone, while somebody is
  reading something else, reaches the page they have open.

  Captures arrive DATED, which is the point of that half — the reader was not
  looking at the inbox when it was sent, so the day's journal is where it gets
  noticed.

  `@scratch:` because a capture writes the directory it is served, and mints
  `_olai/Inbox.olai` in it — and `@share-scratch` because the restore between
  scenarios REMOVES a file the fixture does not have, which is exactly what a
  minted inbox is. So the whole feature costs one server rather than four, and
  the first line of every scenario ("no Inbox") is what proves the restore took.

  Scenario: A capture reaches the page somebody already has open
    # Nothing is reloaded and nothing is pressed: the door is opened from
    # outside and the sidebar follows the disk like any other write.
    Given I open the outline "house.olai"
    And the sidebar offers no Inbox
    When "srid@example.com" captures "look into the new cabinets" over HTTP
    Then the sidebar offers the Inbox
    And the Inbox wears a count of 1
    And there should be no page errors

  Scenario: …and lands on today, because nobody was looking at the inbox
    Given I open today
    When "phone@example.com" captures "call the electrician" over HTTP
    Then what was captured is on today
    And there should be no page errors

  Scenario: A captured mail keeps a link that opens Mail, not a page of this app
    # The two riders, end to end and in a real browser: `message:` is on the
    # sanitiser's href allowlist (`markdown/sanitise.ts`), so the pointer
    # survives — and this app claims no press on it, so the browser follows the
    # href and hands the scheme to the OS.
    Given I open the outline "house.olai"
    When "srid@example.com" captures the mail "the thread about cabinets" pointing at "message://%3Cabc123@mail.example%3E"
    And I open what was captured
    Then the note links to "message://%3Cabc123@mail.example%3E"
    And there should be no page errors

  Scenario: A capture with no identity is refused, and the page is untouched
    Given I open the outline "house.olai"
    When a capture arrives with no identity header
    Then the sidebar offers no Inbox
    And there should be no page errors
