@scratch:good
Feature: The connection is visible, and a replaced server is recoverable
  A page that is live and a page whose server died look identical when nothing
  says otherwise: both keep showing the last thing they were told. So the page
  says. A pill in the app header reports the connection in every shape of the app,
  and it is green only while a server is actually answering.

  The state that must never look healthy is the last one here, and it must not
  look like the transient one either. When a server is restarted, the tab
  reconnects presenting the process id it was given by the server that is gone;
  the new one does not recognise it and closes the socket at the handshake,
  which RETIRES the wire for good — no reconnect will ever come. There is
  nothing to wait for, so the page stops pretending and offers the only thing
  that works: a reload. Neither half of that handshake is olai's code — the
  framework probes the server's identity and echoes it — which is exactly why
  these scenarios exist: nothing in olai would fail to compile if it stopped.

  These scenarios RESTART the server they are being served by, which is why
  they are `@scratch:` — a private copy of the `good` corpus with a server of
  its own, both thrown away with the scenario. Nothing else in the suite does
  that, and that gap is why a tab holding a dead server shipped unnoticed.

  Background:
    Given I open the outline "garden.olai"

  Scenario: A server that goes away is reported, not hidden
    Given the connection is "live"
    When the server stops
    Then the connection is "reconnecting"

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
    And the restart notice is shown
    When I reload from the restart notice
    Then the connection is "live"
    And the outline list is shown

  Scenario: The reloaded page is as live as the one before it
    # Recovery means the page WORKS again, which is a stronger claim than the
    # connection being green: the reloaded document has to be following the
    # files on disk through the new server, with nobody touching it.
    Given the connection is "live"
    When the server stops
    And the server starts again on the same port
    And I reload from the restart notice
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
