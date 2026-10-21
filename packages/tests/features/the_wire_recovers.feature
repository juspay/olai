@scratch:good
Feature: A blink is not an outage, and a silent socket is brought back
  A reconnect is not a one-second outage to a person reading a page. The socket
  closes, the link redials on its own, and on a laptop that is a Wi-Fi roam, a
  tab woken from sleep, or a watchdog forcing a half-open wire to start again —
  all of which heal well under a second. Freezing the whole page for that blink
  is the flash this feature is about: the offline overlay waits for the
  down-state to PERSIST (`DISCONNECT_OVERLAY_GRACE_MS`), while the readout stays
  instantaneous for the doors that ask questions.

  The other half is the reverse: a socket that stays OPEN and stops answering is
  the state nothing in the transport can see. The watchdog probes it on its own
  clock and forces it to reconnect, which is why the page comes back at all.

  Scenario: A sub-second blink never freezes the page
    Given the wire can blink
    And I open the outline "house.olai"
    And the connection is "live"
    When the wire blinks
    # The socket closed and the app redialled; the overlay never opened for it.
    Then the offline overlay never appeared
    And the connection is "live"

  Scenario: A socket that goes silent is recovered and the page comes back
    # The WIRE IS OPEN and no longer answering — the half-open socket a laptop
    # sleep or an idle NAT leaves behind. Nothing reports a close, so the
    # transport never notices; only the watchdog can.
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    And the connection is "live"
    When I hold incoming updates to the original browser tab
    Then the connection is "reconnecting"
    When I release incoming updates to the original browser tab
    Then the connection is "live"
    And the overlay is gone
