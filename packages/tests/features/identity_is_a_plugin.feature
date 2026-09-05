@scratch:good
Feature: Who is looking is a plugin
  Identity is a row. A serve that does not name it has no chip in the bar and
  no reading behind the door: the proxy still injects its headers, and nobody
  is reading them, so every request is nobody. That is "no provider mounted",
  not a chip that says anonymous.

  @plugins:chat,claude,git
  Scenario: A serve that did not name identity draws no chip at all
    Given I am the Tailscale user "ada@example.com"
    When I open the app
    Then the header has no identity chip
    And there should be no page errors

  @plugins:chat,claude,git
  Scenario: Switching the row on names its headers without a restart
    # THE OTHER DIRECTION, on a serve that came up WITHOUT the row — which is
    # the half that needed a restart until the allowlist could follow the live
    # row (juspay/kolu#2229). The socket this tab opened at boot was allowed to
    # keep no headers, because nobody was standing behind the door to name any;
    # switching the row on moves the roster, the tab redials, and the upgrade
    # that redial performs is where the names arrive. So the chip drawing Ada
    # is the whole claim: not that the reading works, but that the header
    # reached a socket that was accepted after the press.
    Given I am the Tailscale user "ada@example.com"
    When I open the app
    Then the header has no identity chip
    When I open the plugins panel
    And I switch the plugin "identity" on
    Then the header shows the identity "ada@example.com"
    And there should be no page errors

  Scenario: Identity follows plugin restoration and socket reconnection
    # THE FLIP, on the half a unit test cannot reach. The server's side is
    # `identity.test.ts` (both doors answer nobody from the next request on,
    # and Ada again when it is switched back); this is the bar, where a person
    # is looking while they press it.
    Given I am the Tailscale user "ada@example.com"
    When I open the app
    Then the header shows the identity "ada@example.com"
    When I open the plugins panel
    And I switch the plugin "identity" off
    Then the header has no identity chip
    # A new upgrade must read the current proxy headers, not the cached person.
    When I am the Tailscale user "grace@example.com"
    And I switch the plugin "identity" on
    Then the header shows the identity "grace@example.com"
    And there should be no page errors
    When I close the plugins panel
    And I mark the page
    And the browser goes offline
    Then the connection is "reconnecting"
    When I am the Tailscale user "lin@example.com"
    And the browser comes back online
    Then the connection is "live"
    And the header shows the identity "lin@example.com"
    And the page has not reloaded
