Feature: Plugin changes preserve working navigation and editing
  The runtime rebuilds the browser's contributions when a row changes. Test
  the page and its data after that rebuild, not only the plugin switch's label.

  @scratch:journal
  Scenario: A journal route returns with its data after its plugin is remounted
    Given I open the day "2019-11-05"
    And I mark the page
    Then the day open is "2019-11-05"
    When I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    Then the journal chrome is absent
    And no journal page is drawn
    When I open the plugins panel
    And I switch the plugin "journal" on
    And I close the plugins panel
    Then the day open is "2019-11-05"
    And the day "2019-11-05" has something on it
    When I click the day "2019-11-06"
    Then the day open is "2019-11-06"
    And the node "pack" is shown
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda @plugins:chat
  Scenario: A journal enabled for the first time serves its agenda
    Given I open the app
    And I mark the page
    Then the journal chrome is absent
    When I open the plugins panel
    And I switch the plugin "journal" on
    And I close the plugins panel
    And I follow the agenda link
    Then the spine's "late" rows are "permit, visas, posts"
    And the node "permit" has status "doing"
    And the page has not reloaded
    And there should be no page errors

  @scratch:good
  Scenario: Editing and search work after a neighboring plugin leaves
    Given I open the outline "house.olai"
    And I mark the page
    When I filter the page by "hinges"
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    Then the filter box holds "hinges"
    And the node "hinges" is shown
    When I clear the filter
    And I click the title of "handles"
    And I select all and type "choose the bronze handles"
    And I press "Enter"
    Then "house.olai" holds a node titled "choose the bronze handles"
    When I press the palette shortcut
    And I type "bronze" into the palette
    Then the palette lists the node "choose the bronze handles"
    When I pick the palette item "choose the bronze handles"
    Then the zoomed node is "handles"
    And the page has not reloaded
    And there should be no page errors

  @scratch:good @git:repo
  Scenario: A remounted ledger records edits made while it was absent
    Given I open the outline "house.olai"
    And I mark the page
    When I open the plugins panel
    And I switch the plugin "git" off
    And I close the plugins panel
    Then the header has no git indicator
    When I click the title of "handles"
    And I select all and type "choose the bronze handles"
    And I press "Enter"
    Then "house.olai" holds a node titled "choose the bronze handles"
    And olai has recorded 0 commits here
    When I open the plugins panel
    And I switch the plugin "git" on
    And I close the plugins panel
    Then the header shows one git indicator
    And the commit pill says 1 uncommitted
    When I open the commit panel
    And I commit with the message "edits survived the ledger flip"
    Then the commit pill says "committed"
    And the last commit is "olai: edits survived the ledger flip" by "web"
    And the repository is clean
    And the page has not reloaded
    And there should be no page errors
