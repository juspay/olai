@corpus:good
Feature: The header shows who you are
  A reverse proxy injects a trusted login header (and optionally an email).
  Default wiring is `tailscale serve`'s Tailscale-User-Login. The header
  draws that person — a gravatar from the hashed email, and the login
  beside it (or on hover) — and draws nothing at all when the header is
  absent. Direct access and a local serve are the absence: nothing invents
  a user, and nothing else in the bar breaks.

  The chip is next to the wordmark, not in the pills. The wordmark is the
  APP; this is WHO IS LOOKING. The chrome row still answers for git with
  one pill, which is a different question.

  Scenario: Direct access draws no identity chip
    When I open the app
    Then the header has no identity chip
    And there should be no page errors

  Scenario: A Tailscale login is the gravatar and the name
    Given I am the Tailscale user "ada@example.com"
    When I open the app
    Then the header shows the identity "ada@example.com"
    And the identity gravatar is hashed from "ada@example.com"
    And there should be no page errors
