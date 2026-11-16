Feature: Finding your way to a new plugin
  A plugin somebody asked for is in the **Plugins** section of the sidebar from
  then on, beside Chats and Outlines — and the section is there BEFORE the
  first one, because a vault with no plugins is exactly the vault where
  somebody is trying to make their first.

  THE EMPTY VAULT IS THE FIRST CLAIM and it is not an edge case. The section
  used to arrive with the first folder, on the argument that the column is the
  most expensive surface in the app; a person who deployed the branch answered
  that argument in one sentence — *how do I create a plugin? I see nothing in
  the sidebar* — because the only other door was a palette row you have to
  already know the name of. So the heading stands, with its `+`, and an empty
  vault gets one quiet row under it that opens the same two levels ⌘K does.

  THE PANEL IS THE OTHER DOOR, and it is asserted here with the sidebar's
  because the two have to agree. A person looking for plugins presses the
  health dot and picks **Plugins**: that panel lists everything this serve is
  running and used to offer no way to ask for one more. It now has a **New
  plugin** row, drawn only while something offers the verb
  (`vault-plugins.new-plugin`), so a serve without this row has a panel with
  no door rather than a button with nowhere to go.

  THE MARK IS THE THREE STATES SOMEBODY HAS TO DO SOMETHING ABOUT: a working
  dot while an agent is still writing the folder, `Review` while a version is
  waiting to be read, `Problem` when it would not start. A plugin that is
  simply on wears nothing, and one that is switched off says so with its ink —
  because a row that always wears a badge is a row whose badge nobody reads.
  The working dot is asserted where it actually happens, in
  `asking_for_a_plugin.feature`, since a folder is only ever half-written while
  an agent is writing it.

  AND IT WITHDRAWS WITH THE ROWS IT IS MADE OF. The section is this row's face
  hung in the sidebar's own furniture, so switching off either one takes it
  away — which is the honest behaviour of a composed shell and the thing a
  hard-coded section would quietly get wrong. (There is no scenario for a
  sidebar with no PALETTE, where the `+` goes and the row becomes a sentence:
  `layout` declares navigation, so a serve that draws a sidebar at all has a
  palette. That arm is the startup window and a guard against a future
  composition, and it is argued in `Section.tsx` rather than asserted here.)

  @scratch:good
  Scenario: The heading is there before there is anything to put under it
    Given I open the app
    Then the sidebar has a Plugins section
    And the Plugins section is headed "Plugins"
    And the Plugins section lists ""
    # THE WORDS ARE THE FEATURE: somebody who has never heard of a plugin has
    # to be able to read this row and know what pressing it does.
    And the Plugins section invites a first plugin saying "Ask for your first plugin…"
    And the Plugins section offers a new plugin

    When I press the Plugins section's first plugin row
    Then the command palette is open
    And the palette path is "new-plugin"
    When I press "Escape"

    # ...and the `+` beside the heading is the same gesture for a person who
    # already knows what it makes. A second way of asking would be a second
    # thing to learn, so both open the same two levels.
    When I press the Plugins section's plus
    Then the command palette is open
    And the palette path is "new-plugin"
    When I press "Escape"

    When a plugin folder "borrowed" is copied in
    Then the Plugins section lists "borrowed"
    # The invitation leaves as soon as there is something real under the
    # heading: it is an empty state, not a permanent button.
    And the Plugins section invites no first plugin
    # A ROW IS AN ANCHOR at the plugin's own address, which is what makes the
    # page linkable, the keyboard useful and the middle-click ordinary.
    And the Plugins row "borrowed" is a link to its page
    And the Plugins row "borrowed" says "A plugin somebody copied in from another vault."

    When the folder "plugins/borrowed" is deleted
    # ...and it comes back with the last plugin, rather than leaving a heading
    # over nothing.
    Then the Plugins section lists ""
    And the Plugins section invites a first plugin saying "Ask for your first plugin…"
    And there should be no page errors

  @phone @scratch:good
  Scenario: A handset reaches New plugin from the drawer
    # The thumb bar's `+` is Inbox capture, so without this row a phone's only
    # way to a plugin is a keyboard shortcut a phone does not have. The drawer
    # puts itself away on a press inside it, which is what lets the palette
    # come up over a screen this narrow.
    Given I open the app
    Then the sidebar has a Plugins section
    When I press the Plugins section's first plugin row
    Then the command palette is open
    And the palette path is "new-plugin"
    And there should be no page errors

  @scratch:good
  Scenario: The plugins panel is a door onto New plugin too
    # Where a person looks for plugins when the column is collapsed, or when
    # they are looking for what this serve is running: the health dot, then
    # Plugins.
    Given I open the app
    When I open the plugins panel
    Then the plugins panel offers a new plugin

    When I press the plugins panel's new plugin door
    # The panel goes first: a palette opening behind a popover is a box nobody
    # can see.
    Then the plugins panel is shut
    And the command palette is open
    And the palette path is "new-plugin"
    And there should be no page errors

  @scratch:plugins
  Scenario: ...and it is there on a vault that already has some
    # Asking for another is not an empty-state gesture, so the door does not
    # leave with the first plugin the way the sidebar's row does.
    Given I open the outline "colours.olai"
    When I open the plugins panel
    Then the plugins panel offers a new plugin
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
    # ...and the ADDRESS draws nothing of this row either: the grammar belongs
    # to its browser half, so with the row off there is no page to mount. (What
    # a pane shows for an address NOBODY claims is navigation's own business
    # and the same for any unclaimed path.)
    When I open the address "/plugins/swatch"
    Then no plugin page is drawn
    # ...and the PANEL's door goes with it, which is the half a held service
    # gets right and an import would not: the inspector still lists what this
    # serve runs, with nothing offering `vault-plugins.new-plugin` there is
    # simply no row to press, and nothing else about the panel changes.
    When I open the plugins panel
    Then the plugins panel offers no new plugin
    And there should be no page errors
