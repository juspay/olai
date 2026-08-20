@scratch:good
Feature: A dead wire freezes the app, and a replaced server is recoverable
  A page that is live and a page whose server died look identical when nothing
  says otherwise: both keep showing the last thing they were told. So the page
  says. A pill in the app header reports the connection in every shape of the
  app, and it is green only while a server is actually answering.

  And since the browser stopped holding the vault, saying so is not enough.
  Every page, every search, every filter is a QUESTION now, so a page left
  interactive under a dead socket is a page of doors that pretend — which is why
  the human's ruling (`brainstorming/vault-in-browser.md` §5b) is that the app
  FREEZES: an overlay covers it, wearing the pill's own words, and nothing
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

  Scenario: A server that goes away is reported, not hidden
    Given the connection is "live"
    When the server stops
    Then the connection is "reconnecting"

  Scenario: The wire drops, the app freezes, the wire returns and the page is live again
    # The whole of §5b in one pass, and every step of it needs a real browser: a
    # socket dying under a page that was mid-question, an overlay in the top
    # layer over a document the browser itself has made inert, and the same page
    # resuming — not reloading — when the wire comes back.
    #
    # The network goes rather than the server, and that is the only way to see
    # the second half: a server that dies and comes back retires the tab at the
    # handshake, so the page could never come back live. Offline kills the
    # socket and leaves the process alive, so the redial is the same wire
    # returning.
    Given the connection is "live"
    # The marker on `window`, so the last step can tell a page that RESUMED from
    # one that quietly reloaded itself into looking the same.
    And I mark the page
    When I filter the page by "herb"
    Then the filter found "1 of 11"
    When the browser goes offline
    Then the connection is "reconnecting"
    And the app is frozen under the offline overlay
    And the page under it takes neither a press nor a chord
    # The rows the server answered are still the rows behind the overlay:
    # `herbs`, the `garden` above it, and the two under it that a match keeps
    # with it — exactly as before the wire went. A freeze is not a blank page.
    And the outline has 4 rows
    # Written while the tab could not hear it, so the reconnect has something to
    # be measured by: the file is rewritten to five nodes, two of which `herb`
    # selects, so BOTH numbers move and neither could have been left standing.
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
    # LIVE AGAIN, and asked again: the filter is a standing question keyed on
    # the set's own generation, the reconnect lands a fresh snapshot, and the
    # count is the answer to what is on disk now. Nothing was reloaded and
    # nobody typed.
    And the filter found "2 of 5"
    And the page has not reloaded

  Scenario: A restarted server retires the tab, and reloading recovers it
    # No "there should be no page errors" here, and deliberately: a browser
    # whose server is gone logs its own failed WebSocket dials, and asserting
    # on a console the browser is entitled to write to would be asserting on
    # Chromium rather than on olai.
    Given the connection is "live"
    And I mark the page
    When the server stops
    And the server starts again on the same port
    # The gate the wire's own `pid` echo feeds: the server closed this tab
    # rather than serving it. Asserted from the server's own log, because a page
    # cannot see the difference between the socket it was refused and one that
    # simply has not opened yet.
    Then the server rejected the stale tab
    And the connection is "retired"
    # The one frozen state with something to offer besides waiting, and the
    # offer is on the overlay rather than on a screen of its own.
    And the overlay offers a reload
    When I reload from the overlay
    Then the connection is "live"
    And the outline list is shown

  Scenario: The reloaded page is as live as the one before it
    # Recovery means the page WORKS again, which is a stronger claim than the
    # connection being green: the reloaded document has to be following the
    # files on disk through the new server, with nobody touching it.
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
