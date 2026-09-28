Feature: The plugins panel reads as headings, one line per plugin
  At rest the panel is a column of group headings, each shut and showing how
  many of its rows are on; only Needs attention opens by itself. A plugin is
  one line — the name the build gives it and its switch — and everything else
  about it sits in its detail, behind a chevron. A row with nothing more to
  say has no chevron at all. The Server section closes the list, shut too.

  @scratch:good
  Scenario: Groups start shut with their counts, and fixtures nobody asked for are not listed
    Given I open the app
    When I open the plugins panel
    Then every plugins panel group starts collapsed except Needs attention
    And the plugins panel lists the group "Agents"
    And the plugins panel lists the group "Notes"
    And the plugins panel lists the group "Connections"
    And the plugins panel lists the group "Interface"
    # The app's own machinery, every row of it quiet, reads after the groups
    # a person is likelier to look for.
    And the plugins panel lists the group "Interface" after the group "Notes"
    And the plugins panel lists the group "Interface" after the group "Connections"
    # The maintained test fixtures ship off and nobody here turned one on.
    And the plugins panel does not list the group "Test fixtures"
    And the plugins panel section counts match their switches
    When I open the plugins panel group "Notes"
    Then the plugins panel groups "vault" under "Notes"
    And the plugins panel section counts match their switches
    And there should be no page errors

  @scratch:good @git:repo
  Scenario: A row's detail opens and shuts behind its chevron
    Given I open the app
    When I open the plugins panel
    And I open the plugins panel group "Notes"
    Then the plugin "git" line reads "Git" beside its labelled enable switch
    And the plugin "git" is collapsed
    When I expand the plugin "git"
    Then the plugin "git" is expanded
    And the plugin "git" has inline controls
    And the plugin "git" detail names its short name
    When I collapse the plugin "git"
    Then the plugin "git" is collapsed
    When I expand the plugin "git"
    Then the plugin "git" is expanded
    And there should be no page errors

  @scratch:good
  Scenario: A row with nothing to reveal has no chevron
    Given I open the app
    When I open the plugins panel
    Then the plugin "tabs" line reads "Tabs" beside its labelled enable switch
    And the plugin "tabs" has nothing to reveal
    And there should be no page errors

  @scratch:good
  Scenario: A session-only switch says so in its row's detail
    Given I open the app
    When I open the plugins panel
    Then the plugin "vault" line reads "Vault" beside its labelled enable switch
    And the plugin "vault" has a session-only switch ring
    And the plugin "vault" detail says "This switch resets when olai restarts."
    And the plugin "vault" detail names its short name
    And there should be no page errors

  @scratch:good
  Scenario: An open row stays open while another plugin is switched and the roster republishes
    Given I open the app
    When I open the plugins panel
    And I expand the plugin "git"
    Then the plugin "git" is expanded
    When I switch the plugin "journal" off
    Then the plugin "journal" is off without prose
    And the plugin "git" is expanded
    And the plugin "git" has inline controls
    When I switch the plugin "journal" on
    Then the plugin "journal" is running
    And the plugin "git" is expanded
    And there should be no page errors

  @scratch:lanes
  Scenario: Rows move between groups live while an open row stays open
    Given I open the outline "lanes.olai"
    When I open the plugins panel
    And I expand the plugin "git"
    And I switch the plugin "chat" off
    # Kolu stands behind chat's doors, so it moves under Needs attention — a
    # group that was not there a moment ago for it — and opens with its detail
    # showing, because its detail is what to do.
    Then the plugins panel groups "kolu" under "Needs attention"
    And the plugins panel lists the group "Needs attention"
    And the plugin "git" is expanded
    When I switch the plugin "chat" on
    Then the plugins panel groups "kolu" under "Connections"
    And the plugin "git" is expanded
    And the plugins panel section counts match their switches
    And there should be no page errors

  @scratch:lanes
  Scenario: Turning off a row others stand behind asks on the row, naming them by label
    Given I open the outline "lanes.olai"
    When I open the plugins panel
    And I request that the plugin "chat" be off
    Then the plugins panel asks to confirm turning "chat" off
    And the confirm for "chat" names "Kolu"
    And the confirm for "chat" names the plugins it stops by their labels
    # Keep on is the answer that changes nothing.
    When I keep the plugin "chat" on
    Then the plugin "chat" is running
    And chat controls are in the outline
    When I request that the plugin "chat" be off
    Then the plugins panel asks to confirm turning "chat" off
    When I confirm turning the plugin "chat" off
    Then the plugins panel groups "kolu" under "Needs attention"
    And chat controls are gone-from the outline
    When I switch the plugin "chat" on
    Then the plugin "chat" is running
    And the plugins panel says nothing more about "kolu"
    And there should be no page errors

  @scratch:good
  Scenario: The Server section starts shut and says where and how this serve runs
    Given I open the app
    When I open the plugins panel
    Then the Server section is folded
    And the Server section closes the plugins panel
    When I open the Server section
    Then the Server section lists this serve's address
    And the Server section lists "Access token" as "Set"
    And the Server section lists "State folder" as "$XDG_STATE_HOME/olai"
    And the Server section offers its log settings and never shows the token
    And the Server section reads "log-level" as "info" from "default"
    And there should be no page errors

  @scratch:good
  Scenario: A serve with no access token says Not set
    Given the roster says this serve has no access token
    And I open the app
    When I open the plugins panel
    And I open the Server section
    Then the Server section lists "Access token" as "Not set"
    And there should be no page errors
