@scratch:good
Feature: A dead wire freezes the app, and a replaced server is recoverable
  A page that is live and a page whose server died look identical when nothing
  says otherwise: both keep showing the last thing they were told. So the page
  says. On a desktop the header's health dot reports the connection (its row
  reads `Connected` only while a server is actually answering), and in every
  shape of the app a dead wire is a card over the page.

  And since the browser stopped holding the vault, saying so is not enough.
  Every page, every search, every filter is a QUESTION now, so a page left
  interactive under a dead socket is a page of doors that pretend — which is why
  the human's ruling (`brainstorming/vault-in-browser.md` §5b) is that the app
  FREEZES: an overlay covers it, in the words the dot uses, and nothing
  underneath answers a press or a chord until the wire comes back. This app is
  live or nothing, and this is the "or nothing".

  The state that must never look healthy is the last one here, and it must not
  look like the transient one either. When a server is restarted, the tab
  reconnects presenting the process id it was given by the server that is gone;
  the new one does not recognise it and closes the socket at the handshake,
  which RETIRES the wire for good — no reconnect will ever come. There is
  nothing to wait for, so the page stops pretending and offers the only thing
  that works: a reload, on the overlay itself.

  These scenarios cut the wire under an open tab — some by RESTARTING the
  server they are being served by — which is why they are `@scratch:`: a
  private copy of the `good` corpus with a server of its own, both thrown away
  with the scenario. Nothing else in the suite does that, and that gap is why a
  tab holding a dead server shipped unnoticed.

  Background:
    Given I open the outline "garden.olai"
    And I show the done nodes

  Scenario: A server that goes away is reported, not hidden
    Given the connection is "live"
    When the server stops
    Then the connection is "reconnecting"

  Scenario: The wire drops, the app freezes, the wire returns and the page is live again
    Given the connection is "live"
    And I mark the page
    When I filter the page by "herb"
    Then the filter found "1 of 11"
    When the browser goes offline
    Then the connection is "reconnecting"
    And the app is frozen under the offline overlay
    And the offline overlay reads "Connection lost" over "Reconnecting…"
    And the page under it takes neither a press nor a chord
    And the outline has 4 rows
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil in trays","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true}
      {"id":"thyme","parent":"herbs","ord":"a2","title":"a second herb bed for thyme"}
      """
    And the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    And the filter found "2 of 5"
    And the page has not reloaded

  Scenario: A restarted server retires the tab, and reloading recovers it
    Given the connection is "live"
    And I mark the page
    When the server stops
    And the server starts again on the same port
    Then the server rejected the stale tab
    And the connection is "retired"
    And the overlay offers a reload
    And the offline overlay reads "The server restarted" over "Reload the page to keep working."
    And the overlay's reload is called "Reload"
    When I reload from the overlay
    Then the connection is "live"
    And the outline list is shown

  Scenario: The reloaded page is as live as the one before it
    Given the connection is "live"
    When the server stops
    And the server starts again on the same port
    And I reload from the overlay
    And I mark the page
    And I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil in trays","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true}
      """
    Then the node "basil" has the title "sow the basil in trays"
    And the page has not reloaded
    And the connection is "live"
