@corpus:good
Feature: The header shows who you are
  A reverse proxy injects a trusted login header, and may inject a display
  name and a picture beside it. Default wiring is `tailscale serve`'s
  Tailscale-User-Login / -Name / -Profile-Pic. The header draws who is
  looking as a closed set of icons, last in the chrome row (top right):
  anonymous when no login came, the person when one did — wearing whichever
  picture the server's ladder resolved (the proxy's own picture, an avatar
  template, the gravatar of a real address) or the same silhouette when it
  resolved none. The words are the tooltip. Nothing invents a user, and
  nothing assumes the login is an email.

  Scenario: Direct access draws anonymous
    When I open the app
    Then the header shows anonymous
    And there should be no page errors

  Scenario: An email login is the gravatar of that address
    Given I am the Tailscale user "ada@example.com"
    When I open the app
    Then the header shows the identity "ada@example.com"
    And the identity picture is the gravatar of "ada@example.com"
    And there should be no page errors

  Scenario: The picture the proxy sends is the one drawn
    Given I am the Tailscale user "ada@example.com"
    And the proxy also sends my picture "https://avatars.example.com/ada.png"
    And the picture at "https://avatars.example.com/ada.png" is a real image
    When I open the app
    Then the header shows the identity "ada@example.com"
    And the identity picture is "https://avatars.example.com/ada.png"
    And there should be no page errors

  Scenario: A GitHub-backed login is not an email — the silhouette, by name
    Given I am the Tailscale user "srid@github"
    And the proxy also says my name is "Sridhar Ratnakumar"
    When I open the app
    Then the header shows the identity "srid@github"
    And the header calls me "Sridhar Ratnakumar (srid@github)"
    And the identity chip draws no picture
    And there should be no page errors

  @scratch:good @avatar-template
  Scenario: An avatar template pictures a login no gravatar can
    Given I am the Tailscale user "srid"
    And the picture at "https://github.com/srid.png" is a real image
    When I open the app
    Then the header shows the identity "srid"
    And the identity picture is "https://github.com/srid.png"
    And there should be no page errors

  Scenario: A connected tab does not fetch GET /olai/who
    # The chip reads who.get off the upgrade. GET /olai/who stays for a
    # share sheet and a script, which have no websocket. A failed ask is
    # a throw the resource treats as the error face (who/fromAsk.ts), not
    # an intercepted GET.
    Given I am the Tailscale user "ada@example.com"
    When I open the app
    Then the header shows the identity "ada@example.com"
    And nothing fetched "/olai/who"
