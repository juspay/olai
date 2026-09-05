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
    # ...and back, in the same process: the headers this socket may carry were
    # fixed when the port bound and nobody took them away, so the reading
    # returning is the whole of what has to happen for Ada to be Ada again.
    When I switch the plugin "identity" on
    Then the header shows the identity "ada@example.com"
    And there should be no page errors
