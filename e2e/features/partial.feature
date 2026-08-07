Feature: navigating without rebuilding the page

  A link here fetches the outline region and morphs it into place. The address
  moves, the tab is renamed, and everything the region is not — the sidebar,
  the chat panel, the skin — is the same DOM it was before the click. The href
  is still on the link, so no-JS, middle-click and copy-link are unharmed.

  Scenario: the chat panel is the same element after navigating
    When I open the home page
    And I mark this page load
    And I mark the chat panel
    And I zoom into the sidebar's "Ship the server"
    Then I am on a node's own page
    And the chat panel is the one I marked
    And the page has not reloaded

  Scenario: a chat panel left open stays open across navigation
    When I open the home page
    And I mark this page load
    And I press the agent toggle
    And I zoom into the sidebar's "Ship the server"
    Then I am on a node's own page
    And the chat panel is open
    And the page has not reloaded

  Scenario: every navigation link keeps a plain href
    When I open the home page
    Then the sidebar links to "/archive"
    And every link in the sidebar tree has an href

  Scenario: back and forward go through the same region
    When I open the home page
    And I mark this page load
    And I zoom into "Inbox"
    Then I am on a node's own page
    When I go back
    Then I am back on the home page
    And I see the title "Ship the server"
    And the page has not reloaded
