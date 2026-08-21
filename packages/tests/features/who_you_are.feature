@corpus:good
Feature: The header shows who you are
  A reverse proxy injects a trusted login header (and optionally an email).
  Default wiring is `tailscale serve`'s Tailscale-User-Login. The header
  draws who is looking as a closed set of icons, last in the chrome row
  (top right): anonymous when the header is absent, the gravatar when it
  is present, a failed door when the ask broke. The words are the
  tooltip. Nothing invents a user.

  Scenario: Direct access draws anonymous
    When I open the app
    Then the header shows anonymous
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
