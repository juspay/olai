@scratch:chat
Feature: Plugins depend on doors
  The Spaces mirror consumes chat.seating. Its reading disappears with its
  provider and returns on reactivation, without importing the provider package.

  @plugins:chat,claude,xyne-spaces
  Scenario: A mirror follows its seating provider off and back on
    Given I open the app
    And I mark the page
    When I open the plugins panel
    Then the plugins panel says nothing more about "xyne-spaces"
    When I switch the plugin "chat" off
    Then the plugins panel says "xyne-spaces" is "chat.seating"
    When I switch the plugin "chat" on
    Then the plugins panel says nothing more about "xyne-spaces"
    When I switch the plugin "chat" off
    Then the plugins panel says "xyne-spaces" is "chat.seating"
    When I switch the plugin "chat" on
    Then the plugins panel says nothing more about "xyne-spaces"
    And the page has not reloaded
    And there should be no page errors

  @plugins:xyne-spaces
  Scenario: A mirror waiting at startup activates when chat first arrives
    Given I open the app
    When I open the plugins panel
    Then the plugins panel says "xyne-spaces" is "chat.seating"
    When I switch the plugin "chat" on
    Then the plugins panel says nothing more about "xyne-spaces"
    And there should be no page errors

  @plugins:chat,claude,identity
  Scenario: The transcript follows the shared viewer when identity leaves and returns
    Given I am the Tailscale user "ada@example.com"
    And I open the app
    And the agent panel is open
    When I ask the agent "the viewer is shared"
    Then the agent's answer mentions "you said: the viewer is shared"
    And my transcript speaker is "ada@example.com"
    When I open the plugins panel
    And I switch the plugin "identity" off
    And I close the plugins panel
    Then my transcript speaker is "you"
    When I open the plugins panel
    And I switch the plugin "identity" on
    And I close the plugins panel
    Then my transcript speaker is "ada@example.com"
    And there should be no page errors

  @git:repo @plugins:git
  Scenario: An MCP client records the transport writer without chat
    Given I open the app
    And a terminal agent is connected to the served directory
    When the terminal agent captures "a transport write" in "house.olai"
    And the terminal agent commits as "record the transport write"
    Then the last commit is "olai: record the transport write" by "mcp"
    And there should be no page errors

  @plugins:chat,claude
  Scenario: The speaker waits visibly while the conversation remains usable
    Given I am the Tailscale user "ada@example.com"
    And I open the app
    And I mark the page
    And the agent panel is open
    When I ask the agent "identity can arrive later"
    Then the agent's answer mentions "you said: identity can arrive later"
    And my transcript speaker is "you"
    And my transcript speaker wears an anonymous silhouette
    When I open the plugins panel
    Then the plugins panel says "chat" is "Browser speaker: waiting for identity.viewer"
    And the browser service catalog excludes "identity.viewer"
    When I switch the plugin "identity" on
    Then the plugin "chat" has no browser warning
    And the browser service catalog includes "identity.viewer"
    When I close the plugins panel
    Then my transcript speaker is "ada@example.com"
    When I open the plugins panel
    And I switch the plugin "identity" off
    Then the plugins panel says "chat" is "identity.viewer"
    And the browser service catalog excludes "identity.viewer"
    When I close the plugins panel
    Then my transcript speaker is "you"
    And my transcript speaker wears an anonymous silhouette
    And the page has not reloaded
    And there should be no page errors
