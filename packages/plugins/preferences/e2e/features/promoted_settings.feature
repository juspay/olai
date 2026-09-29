@scratch:good
Feature: A plugin's own settings can be marked as this panel's preferences
  A config schema leaf a plugin marks as a preference (`preference: true` on the
  schema annotation, read by `@olai/plugin-api/configuration`) is drawn here,
  under a heading named after the plugin, and moves out of the plugins panel
  while that plugin is running. The rows are the plugins panel's own control, so
  the authored marker, the reset, invalid text handling, refusals and Escape
  behave the same in both places.

  WHAT CHANGES IS WHERE THE VALUE IS KEPT. This panel's fixed headings are this
  browser's; a promoted row writes `_olai/Settings.olai` for everybody using
  this directory. So each run of groups closes with its own scope line, and the
  browser-only line can never sit above a shared row — every shared heading
  draws after every fixed one.

  The heading is LIVE: switching the plugin off in another tab withdraws its
  rows from a panel that is open here, and switching it back restores them,
  with no reload.

  Scenario: A promoted leaf is drawn under its plugin's heading, after the fixed ones, and writes the shared file
    Given I open the app
    When I open the preferences
    Then the preferences are headed "Appearance, Outlines, Notifications, Git"
    And the preference "plugin-git-commit" is drawn under the heading "Git"
    And the preference "plugin-git-push" is drawn under the heading "Git"
    And the preference "plugin-git-commit" shows "manual"
    And the preferences group "Git" ends its rows with the scope line "Saved in Settings.olai, for everyone using this directory."
    And the preferences group "Notifications" ends its rows with the scope line "Saved in this browser only."
    When I pick "auto" in the preference "plugin-git-commit"
    Then file "_olai/Settings.olai" has namespace "git" setting "commit" as "auto"
    And the preference "plugin-git-commit" is marked as authored by "vault"
    When I use the default for the preference "plugin-git-commit"
    Then file "_olai/Settings.olai" has namespace "git" setting "commit" as "<absent>"
    And the preference "plugin-git-commit" shows "manual"
    And the preference "plugin-git-commit" is marked as authored by "default"
    And there should be no page errors

  Scenario: A promoted pick survives a server restart
    Given I open the app
    When I open the preferences
    And I pick "auto" in the preference "plugin-git-commit"
    Then file "_olai/Settings.olai" has namespace "git" setting "commit" as "auto"
    When I leave the app
    And the server stops
    And the server starts again on the same port
    And I open the app
    And I open the preferences
    Then the preference "plugin-git-commit" shows "auto"
    And the preference "plugin-git-commit" is marked as authored by "vault"
    And there should be no page errors

  Scenario: The heading leaves and returns live when its plugin is switched off and on from another tab
    # The flip is made from a second tab on purpose: the claim is about a panel a
    # person is looking at when the roster moves under it.
    Given I open the app
    And I mark the page
    When I open the preferences
    Then the preferences are headed "Appearance, Outlines, Notifications, Git"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "git" off
    And I use the original browser tab
    Then the preferences have no "Git" heading
    And the preferences are headed "Appearance, Outlines, Notifications"
    When I use the other browser tab
    And I switch the plugin "git" on
    And I use the original browser tab
    Then the preferences are headed "Appearance, Outlines, Notifications, Git"
    And the page has not reloaded
    And there should be no page errors

  Scenario: An absent settings reader freezes the promoted controls
    # The reader is ABSENT, not the file: its switch is session-only (the file
    # cannot turn it off), so a person switches it off and the schema still
    # declares what is promoted — the controls are drawn and none of them move.
    Given I open the app
    When I open the plugins panel
    And I switch the plugin "settings" off
    And I open the preferences
    Then the preference "plugin-git-commit" is drawn under the heading "Git"
    And the preference "plugin-git-commit" is frozen because "Settings can be edited when the configuration reader is running"
    And there should be no page errors

  Scenario: A broken settings file freezes the promoted controls
    # The reader is up and the file is torn, which is the other freeze: the
    # schema still declares what is promoted, so the rows are drawn and none of
    # them will move.
    Given I open the app
    When I rewrite "_olai/Settings.olai" as:
      """
      {torn line
      """
    And I open the preferences
    Then the preference "plugin-git-commit" is drawn under the heading "Git"
    And the preference "plugin-git-commit" is frozen because "Repair _olai/Settings.olai before changing settings"
    And there should be no page errors

  @rows-off:plugin-inspector
  Scenario: Disabling the inspector withdraws the promoted rows and leaves the rest of the panel
    Given I open the app
    When I open the preferences
    Then the preferences are headed "Appearance, Outlines, Notifications"
    And the preferences have no "Git" heading
    When I pick the theme "pitch"
    Then the page is in the theme "pitch"
    And there should be no page errors

  @scratch:good @rows-on:mail @mail-himalaya:mailbox
  Scenario: A promoted text leaf writes, refuses a bad spelling, and discards a draft on Escape
    Given I open the app
    When I open the preferences
    Then the preference "plugin-mail-poll" is drawn under the heading "Mail"
    And the preference "plugin-mail-poll" shows "2m"
    When I remember the settings file "_olai/Settings.olai"
    And I type "90" into the preference "plugin-mail-poll"
    And I press "Enter" in the preference "plugin-mail-poll"
    Then the preference "plugin-mail-poll" problem says "a positive duration with a unit"
    And the remembered settings file is unchanged
    When I type "1h" into the preference "plugin-mail-poll"
    And I press "Escape" in the preference "plugin-mail-poll"
    Then the preferences are open
    And the preference "plugin-mail-poll" input reads "2m"
    When I type "1h" into the preference "plugin-mail-poll"
    And I press "Enter" in the preference "plugin-mail-poll"
    Then file "_olai/Settings.olai" has namespace "mail" setting "poll" as "1h"
    And the preference "plugin-mail-poll" is marked as authored by "vault"
    # RESET, on a TEXT leaf: the property leaves the file and the row reads the
    # schema's default again.
    When I use the default for the preference "plugin-mail-poll"
    Then file "_olai/Settings.olai" has namespace "mail" setting "poll" as "<absent>"
    And the preference "plugin-mail-poll" shows "2m"
    And the preference "plugin-mail-poll" is marked as authored by "default"
    # ...AND ON A MALFORMED FILE VALUE: the refused spelling is drawn, and the
    # reset is the way out of it.
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"mail-settings","ord":"a0","title":"mail","custom":{"on":"yes","poll":"bad"}}
      """
    Then the preference "plugin-mail-poll" shows refused file text "bad" inline with default "2m"
    When I use the default for the preference "plugin-mail-poll"
    Then the preference "plugin-mail-poll" has no problem
    And file "_olai/Settings.olai" has namespace "mail" setting "poll" as "<absent>"
    And there should be no page errors

  Scenario: A pick made elsewhere lands in an open panel
    # A CHANGE FROM OUTSIDE: another tab writes the setting, and then the file
    # itself is rewritten. The panel a person is looking at follows both — the
    # row is drawn off the roster, and the roster follows the serve.
    Given I open the app
    And I mark the page
    When I open the preferences
    Then the preference "plugin-git-commit" shows "manual"
    When I open another browser tab
    And I open the preferences
    And I pick "auto" in the preference "plugin-git-commit"
    And I use the original browser tab
    Then the preference "plugin-git-commit" shows "auto"
    And the preference "plugin-git-commit" is marked as authored by "vault"
    When I rewrite "_olai/Settings.olai" as:
      """
      {"id":"git-policy","ord":"a0","title":"git","custom":{"commit":"off"}}
      """
    Then the preference "plugin-git-commit" shows "off"
    And the page has not reloaded
    And there should be no page errors

  @scratch:good @rows-on:mail @mail-himalaya:mailbox
  Scenario: A stopped plugin gives the shared scope line back
    # THE SHARED RUN, WITH TWO PLUGINS IN IT. One scope line closes a run of one
    # scope, so with both up the line sits under the LAST of them — and when
    # `mail` stops, its heading has to be GONE, not merely hidden: a heading that
    # stayed (hidden by CSS, holding the run's line) would take `Git`'s line with
    # it. `mail` is `disabled: true` by default, so this scenario turns it on.
    Given I open the app
    When I open the preferences
    Then the preferences are headed "Appearance, Outlines, Notifications, Git, Mail"
    And the preferences group "Mail" ends its rows with the scope line "Saved in Settings.olai, for everyone using this directory."
    And the preferences group "Git" draws no scope line
    When I open the plugins panel
    And I switch the plugin "mail" off
    And I open the preferences
    Then the preferences have no "Mail" heading
    And the preferences are headed "Appearance, Outlines, Notifications, Git"
    And the preferences group "Git" ends its rows with the scope line "Saved in Settings.olai, for everyone using this directory."
    # ...AND BACK ON: the key was given back, so the second claim is free.
    When I open the plugins panel
    And I switch the plugin "mail" on
    And I open the preferences
    Then the preferences are headed "Appearance, Outlines, Notifications, Git, Mail"
    And the preference "plugin-mail-poll" is drawn under the heading "Mail"
    And there should be no page errors

  @phone
  Scenario: On a phone the promoted rows fit the screen
    When I open the app
    And I open the preferences
    Then the preferences panel fits the screen
    And the preference "plugin-git-commit" is drawn under the heading "Git"
    And there should be no page errors