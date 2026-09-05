@corpus:good @plugins:chat,claude,git
Feature: Who is looking is a plugin
  Identity is a row. A serve that does not name it has no chip in the bar and
  no reading behind the door: the proxy still injects its headers, and nobody
  is reading them, so every request is nobody. That is "no provider mounted",
  not a chip that says anonymous.

  Scenario: A serve that did not name identity draws no chip at all
    Given I am the Tailscale user "ada@example.com"
    When I open the app
    Then the header has no identity chip
    And there should be no page errors
