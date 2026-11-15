Feature: The Plugins section in the sidebar
  A plugin somebody asked for is in the **Plugins** section from then on, beside
  Chats and Outlines. A vault with no plugins has no such section.

  THE ABSENCE IS THE FIRST CLAIM and not an edge case. Most vaults define no
  plugins and never will; a section standing there empty would be the app
  advertising a feature at somebody who did not ask for one, in the one piece of
  furniture that is on screen all day. So it arrives with the first folder and
  leaves with the last, and both halves are asserted here.

  THE MARK IS THE THREE STATES SOMEBODY HAS TO DO SOMETHING ABOUT: a working dot
  while an agent is still writing the folder, `Review` while a version is
  waiting to be read, `Problem` when it would not start. A plugin that is simply
  on wears nothing, and one that is switched off says so with its ink — because
  a row that always wears a badge is a row whose badge nobody reads. The working
  dot is asserted where it actually happens, in `asking_for_a_plugin.feature`,
  since a folder is only ever half-written while an agent is writing it.

  AND IT WITHDRAWS WITH THE ROWS IT IS MADE OF. The section is this row's face
  hung in the sidebar's own furniture, so switching off either one takes it
  away — which is the honest behaviour of a composed shell and the thing a
  hard-coded section would quietly get wrong.

  @scratch:good
  Scenario: It arrives with the first plugin and leaves with the last
    Given I open the app
    Then the sidebar has no Plugins section

    When a plugin folder "borrowed" is copied in
    Then the sidebar has a Plugins section
    And the Plugins section is headed "Plugins"
    And the Plugins section lists "borrowed"
    # A ROW IS AN ANCHOR at the plugin's own address, which is what makes the
    # page linkable, the keyboard useful and the middle-click ordinary.
    And the Plugins row "borrowed" is a link to its page
    And the Plugins row "borrowed" says "A plugin somebody copied in from another vault."
    # ...and the `+` is ⌘K → New plugin by another door, for the person who is
    # already looking at the list.
    And the Plugins section offers a new plugin
    # ...and it opens the same two levels ⌘K does, because a second way of
    # asking for a plugin would be a second thing to learn.
    When I press the Plugins section's plus
    Then the command palette is open
    And the palette path is "new-plugin"
    When I press "Escape"

    When the folder "plugins/borrowed" is deleted
    Then the sidebar has no Plugins section
    And there should be no page errors

  @scratch:plugins
  Scenario: The mark is what somebody has to do about it
    Given I open the outline "colours.olai"
    Then the Plugins section lists "greeting, swatch"
    # READY FOR YOU: a version nobody has read yet.
    And the Plugins row "swatch" is marked "review"

    When I approve the plugin "swatch"
    # NOTHING AT ALL once it is on, which is the design: there is nothing being
    # asked of anybody.
    Then the Plugins row "swatch" wears no mark
    And the Plugins row "swatch" is "on"
    And the Plugins row "swatch" is switched on

    When I switch the plugin "swatch" off on its page
    # Still nothing to do — and the row says what it is with its own state
    # rather than with a word beside it.
    Then the Plugins row "swatch" wears no mark
    And the Plugins row "swatch" is "off"
    And the Plugins row "swatch" is switched off

    When I approve the plugin "swatch"
    And the plugin's face is edited
    # PAUSED IS A REVIEW: the switch is still up and what was running stopped,
    # so there is a decision waiting.
    Then the Plugins row "swatch" is marked "review"
    And the Plugins row "swatch" is "paused"

    When I read the plugin "swatch" again
    And I press the plugin page verb
    And the file "plugins/swatch/server.ts" is deleted
    # PROBLEM: it would not start, and no mark in this product is louder.
    Then the Plugins row "swatch" is marked "problem"
    And there should be no page errors

  @scratch:plugins
  Scenario: Pressing a row opens its page and marks it as the one you are on
    Given I open the outline "colours.olai"
    When I go to the plugin "greeting"
    Then the address is "/plugins/greeting"
    And the Plugins row "greeting" is current
    And the Plugins row "swatch" is not current
    And there should be no page errors

  @scratch:plugins @rows-off:sidebar
  Scenario: With the sidebar row off there is nowhere to hang it
    # The section is a face in the sidebar's furniture, not a thing the shell
    # knows about — so a serve composed without that row draws no section and no
    # error, and the pages are still reachable by address.
    Given I open the app
    Then the sidebar has no Plugins section
    When I open the plugin page for "swatch"
    Then the plugin page is about "swatch"
    And the plugin page is "review"
    And there should be no page errors

  @scratch:plugins @rows-off:vault-plugins
  Scenario: With this row off there are no vault plugins at all
    # THE CLAIM LEAVES WITH THE ROW: `.ts` under `plugins/` is a kind of file
    # this serve holds because THIS row registers the claim, so switching it off
    # stops the halves being in the set — which is the honest state, since there
    # is nothing left to read them. The section goes, the address is nobody's,
    # and the files are ordinary bytes on a disk again.
    Given I open the app
    Then the sidebar has no Plugins section
    When I open the address "/plugins/swatch"
    Then a not-found is shown
    And there should be no page errors
