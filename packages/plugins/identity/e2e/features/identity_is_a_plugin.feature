@scratch:good
Feature: Who is looking is a plugin
  Identity is a row. A serve that does not name it has no chip in the bar and
  no reading behind the door: the proxy still injects its headers, and nobody
  is reading them, so every request is nobody. That is "no provider mounted",
  not a chip that says anonymous.

  @rows:vault,olai,chat,claude,git,ws,web-app,mcp,ui-renderer,layout,sidebar,preferences,theme,plugin-inspector,navigation,outlines,markdown,files,pins,capture,trash,vault-plugins
  Scenario: A serve that did not name identity draws no chip at all
    Given I am the Tailscale user "ada@example.com"
    When I open the app
    Then the header has no identity chip
    And there should be no page errors

  @rows:vault,olai,chat,claude,git,ws,web-app,mcp,ui-renderer,layout,sidebar,preferences,theme,plugin-inspector,navigation,outlines,markdown,files,pins,capture,trash,vault-plugins
  Scenario: Switching the row on names its headers without a restart
    Given I am the Tailscale user "ada@example.com"
    When I open the app
    Then the header has no identity chip
    When I open the plugins panel
    And I mark the page
    And I switch the plugin "identity" on
    Then the header shows the identity "ada@example.com"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Identity follows plugin restoration and socket reconnection
    Given I am the Tailscale user "ada@example.com"
    When I open the app
    Then the header shows the identity "ada@example.com"
    When I open the plugins panel
    And I switch the plugin "identity" off
    Then the header has no identity chip
    When I switch the plugin "identity" on
    Then the header shows the identity "ada@example.com"
    When I am the Tailscale user "grace@example.com"
    And I switch the plugin "journal" off
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
