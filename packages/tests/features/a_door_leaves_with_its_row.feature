Feature: A reading leaves with the row that offered it, and comes back
  The audit's phase 2 moved a set of LIVE VALUES that used to cross package
  walls as module variables onto declared services. Every one of them was a
  reading one row publishes and another draws — the outline's naming of a node,
  the pinned shelf, where a minted note is opened, the box an overlay hangs
  from — and none of them had a dependency the runtime could see. Nothing
  withdrew when the provider stopped except the variable going quiet on its own
  good behaviour.

  What that changes for a person is the same three moments in every case: the
  reading is there while the provider is, the CONSUMER keeps working without it
  (drawing the absence, not an error and not a blank page), and the reading
  comes back when the provider does — with no reload.

  These are the moments a unit bench cannot make, because the claim is about a
  BROWSER HALF being torn down and stood back up under a page somebody is
  looking at. Each scenario switches ONE row and asserts about a different row's
  page.

  @scratch:chat @node-idle-fast
  Scenario: Withdrawing outlines disposes its folds and restoring it restores the readings
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And I mark the page
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "done order"
    Then the agent is idle
    And the agent's answer names the node "order"
    When I open the plugins panel
    And I switch the plugin "outlines" off
    And I close the plugins panel
    Then no agent fold is open
    And the agent "kitchen" stands "asleep"
    When I open the plugins panel
    And I switch the plugin "outlines" on
    And I close the plugins panel
    And the node agent's fold is ready
    Then the agent's answer names the node "order"
    When I ask the agent "after the outline returned"
    Then the agent has answered "after the outline returned" exactly once
    And the page has not reloaded
    And there should be no page errors

  # §10: the fixed box every overlay over the outline hangs from. It was
  # `@olai/web`'s, appended on first use and remembered for the life of the tab.
  @scratch:good
  Scenario: The overlay socket leaves with the outline and does not accumulate
    Given I open the outline "house.olai"
    And I mark the page
    Then the page has 1 overlay socket
    When I open the plugins panel
    And I switch the plugin "outlines" off
    # The residue this asserts against is invisible: an empty fixed div left on
    # the page draws nothing and blocks nothing. Counting is the only way to
    # see it.
    Then the page has 0 overlay sockets
    When I switch the plugin "outlines" on
    Then the page has 1 overlay socket
    When I switch the plugin "outlines" off
    And I switch the plugin "outlines" on
    And I switch the plugin "outlines" off
    And I switch the plugin "outlines" on
    Then the page has 1 overlay socket
    When I close the plugins panel
    And I open the node menu of "hinges"
    Then the node menu is open
    And the page has not reloaded
    And there should be no page errors

  # §12 twice over: `pins.state`, read by the outline's `•••` to decide which of
  # two words its shelf verb wears (one entry with two labels, so the label IS
  # the reading) — and `Edits`, the app's table of which row writes which verb,
  # which the same menu spends when the entry is pressed.
  @scratch:good
  Scenario: The outline's shelf verb follows the pins row off and back on
    Given I open the outline "house.olai"
    And I mark the page
    When I open the node menu of "order"
    And I choose "Pin to sidebar" from the node menu
    Then the pinned shelf holds "/#order"
    When I open the node menu of "order"
    Then the node menu offers "Unpin from sidebar"
    When I click away from the node menu
    And I open the plugins panel
    And I switch the plugin "pins" off
    And I close the plugins panel
    # The outline is a whole outline with no pins row: the shelf is gone, and
    # the menu asks a question nobody is answering, so it reads as unpinned.
    Then the pinned shelf is not drawn
    When I open the node menu of "order"
    Then the node menu offers "Pin to sidebar"
    # ...AND PRESSING IT IS REFUSED IN WORDS. `pin` is the pins row's verb on
    # the app's edit table (`@olai/plugin-api`'s `Edits`), and a verb whose
    # claimant has left is refused the way it always was — the outline does not
    # send it into a table that no longer routes it, and the reader is told.
    When I choose "Pin to sidebar" from the node menu
    Then the node menu of "order" says "the capability for pin is not active"
    And the pinned shelf is not drawn
    When I open the plugins panel
    And I switch the plugin "pins" on
    And I close the plugins panel
    Then the pinned shelf holds "/#order"
    When I open the node menu of "order"
    Then the node menu offers "Unpin from sidebar"
    And the page has not reloaded
    And there should be no page errors

  # §5 in the browser: `markdown.editing`, which the day page asks for the file
  # it just minted. The journal does not wait for it — the calendar, the agenda
  # and every day page are the journal's own.
  @scratch:journal
  Scenario: The day page keeps its day without the row that opens a minted note
    Given I open the day "2019-11-06"
    And I mark the page
    Then the day lists "pack"
    And the + day note button is shown
    When I open the plugins panel
    And I switch the plugin "markdown" off
    And I close the plugins panel
    Then the day open is "2019-11-06"
    And the day lists "pack"
    But the + day note button is gone
    When I open the plugins panel
    And I switch the plugin "markdown" on
    And I close the plugins panel
    Then the + day note button is shown
    And the page has not reloaded
    And there should be no page errors

  # The routes half of the same phase: an address a PLUGIN claims can only be
  # read while that plugin is mounted, and `Routing` is how a shelf in another
  # package asks. A pin to a page whose row has left is left off the shelf
  # rather than drawn as somewhere else — and the file keeps it throughout.
  @scratch:journal
  Scenario: A pinned journal day leaves the shelf with the journal, and the file keeps it
    Given the directory has the pins:
      | /work.olai    |
      | /d/2019-11-05 |
    And I open the day "2019-11-05"
    And I mark the page
    Then the pinned shelf reads "/work.olai /d/2019-11-05"
    When I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    Then the pinned shelf reads "/work.olai"
    And "Pins.olai" holds a node titled "/d/2019-11-05"
    When I open the plugins panel
    And I switch the plugin "journal" on
    And I close the plugins panel
    Then the pinned shelf reads "/work.olai /d/2019-11-05"
    And the page has not reloaded
    And there should be no page errors
