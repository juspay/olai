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

  Scenario: Switching the row off takes the chip out of the bar while you watch
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
    # ...and back, in the same process: the reading returns, the tab redials
    # onto the roster that moved, and the socket that redial opens is upgraded
    # with the names the row is offering again.
    When I switch the plugin "identity" on
    Then the header shows the identity "ada@example.com"
    And there should be no page errors
