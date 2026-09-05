@scratch:good
Feature: The renderer and layout are browser rows
  Host selection and browser activation are separate facts. Removing either
  browser owner removes its UI while independent server capabilities survive.

  Scenario Outline: Removing a shell owner leaves the headless vault available
    When I open the app
    And I pick the theme "pitch"
    And I press Escape on the preferences
    And I open the plugins panel
    Then the plugins panel says "<owner>" is "Selected by the host"
    And the plugins panel says "<owner>" is "Browser: running."
    When I request that the plugin "<owner>" be off
    Then the browser mount has no rendered application
    And layout has released its document styles and viewport observers
    When another tab stores theme "reef", font "system", and size "medium"
    Then the page is in the theme "reef"
    And the page is in the font "system"
    And the page is set at "16px"
    And the MCP vault can read an outline
    And the MCP transport answers with status 200
    And there should be no page errors

    Examples:
      | owner       |
      | layout      |
      | ui-renderer |

  Scenario Outline: An optional module failing during cold startup leaves the shell usable
    Given the browser module for "<owner>" cannot be fetched
    When I open the app
    And I open the plugins panel
    Then the plugins panel says "<owner>" is "Module load failed"
    Given I mark the page
    When the browser module can be fetched again
    And I retry the failed browser activation
    Then the browser activation has recovered
    And the page has not reloaded
    And there should be no page errors

    Examples:
      | owner   |
      | pi      |
      | sidebar |

  Scenario: A renderer module failure has a startup diagnostic and can recover
    Given the browser module for "ui-renderer" cannot be fetched
    When I open the browser before an application can mount
    Then browser startup reports its failure
    Given I mark the page
    When the browser module can be fetched again
    And I retry browser startup
    And I open the plugins panel
    Then the plugins panel says "ui-renderer" is "Browser: running."
    And the page has not reloaded
    And there should be no page errors

  Scenario: Layout refits its columns when a desktop window narrows
    When I open the app
    And I open the agent panel again
    And the desktop window narrows to 900 pixels
    Then layout reserves at least 280 pixels for content
    And there should be no page errors

  Scenario: A bootstrap failure is visible before a socket roster and retries without reload
    Given the browser cannot obtain its initial selection
    When I open the browser before an application can mount
    Then browser startup reports its failure
    Given I mark the page
    When the browser selection endpoint recovers
    And I retry browser startup
    Then browser startup has recovered
    And the page has not reloaded
    And there should be no page errors

  Scenario: The sidebar can leave and return without replacing an active editor
    Given I open the outline "house.olai"
    And I mark the page
    And I mark the screen
    When I click the title of "handles"
    And I select all and type "abcde"
    And I press "ArrowLeft"
    And I press "ArrowLeft"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "sidebar" off
    And I use the original browser tab
    Then the sidebar plugin has no rendered column or rail
    And the node "handles" was never taken away
    When I type "|"
    And I use the other browser tab
    And I switch the plugin "sidebar" on
    And I use the original browser tab
    Then the sidebar plugin has a rendered column
    And the node "handles" was never taken away
    When I click away from the editor
    Then "house.olai" holds a node titled "abc|de"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A cached dependency failure offers an honest reload without disturbing surviving content
    Given a static dependency of the browser module for "sidebar" cannot be fetched
    When I open the address "/house.olai"
    Then the node "handles" is shown
    When I mark the page
    And I mark every element of the row "handles"
    And I open the plugins panel
    Then the plugins panel says "sidebar" is "Module load failed"
    When the static dependency can be fetched again
    And I retry the failed browser activation
    Then browser recovery offers a reload for the cached dependency failure
    And the page has not reloaded
    And the row "handles" kept every element it had
    When I reload using browser recovery
    And I open the plugins panel
    Then the plugins panel says "sidebar" is "Browser: running."
    And there should be no page errors

  Scenario: A cached renderer dependency can recover through the startup reload action
    Given a static dependency of the browser module for "ui-renderer" cannot be fetched
    When I open the browser before an application can mount
    Then browser startup reports its failure
    When I mark the page
    And the static dependency can be fetched again
    And I retry browser startup
    Then browser recovery offers a reload for the cached dependency failure
    And the page has not reloaded
    When I reload using browser recovery
    And I open the plugins panel
    Then the plugins panel says "ui-renderer" is "Browser: running."
    And there should be no page errors

  Scenario: Chat owns its alert controls and remembers their values when restored
    Given I open the app
    When I set Alerts to "off"
    And I press Escape on the preferences
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I open the preferences
    Then the preferences have no chat alert controls
    And the preferences retain their Notes control
    When I press Escape on the preferences
    And I open the plugins panel
    And I switch the plugin "chat" on
    And I open the preferences
    Then the Alerts row explains "silent"
    And the alert sound cannot be set
    And there should be no page errors
