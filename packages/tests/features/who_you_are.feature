@corpus:good
Feature: The header shows who you are
  A reverse proxy injects a trusted login header (and optionally an email).
  Default wiring is `tailscale serve`'s Tailscale-User-Login. The header
  draws who is looking as a closed set: nobody when the header is absent,
  the person (gravatar and login) when it is present, a failed door when
  the ask broke. Direct access is nobody — a face, not a missing chip.
  Nothing invents a user.

  The chip is next to the wordmark, not in the pills. The wordmark is the
  APP; this is WHO IS LOOKING. The chrome row still answers for git with
  one pill, which is a different question.

  Scenario: Direct access draws nobody
    When I open the app
    Then the header shows nobody is looking
    And there should be no page errors

  Scenario: A Tailscale login is the gravatar and the name
    Given I am the Tailscale user "ada@example.com"
    When I open the app
    Then the header shows the identity "ada@example.com"
    And the identity gravatar is hashed from "ada@example.com"
    And there should be no page errors

  Scenario: A failed who fetch is not honest absence
    Given asking who you are will fail
    When I open the app
    Then the header identity could not be asked
