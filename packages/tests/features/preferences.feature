@corpus:good
Feature: One place to set how this browser reads
  A trigger in the app header opens a panel of rows, each a label, a control and
  a line under it read off the CHOICE IN FORCE — so the sentence changes when
  you press the control, and the panel answers "what did I just do" in the same
  gesture. The shape is kolu's settings popover; the backing store is
  deliberately not, because olai's preferences are client-local
  (`docs/architecture.md`). Nothing here is a cell, nothing crosses a wire, and
  nothing is committed.

  There is ONE door. The theme pill used to sit in the bar beside this trigger,
  which was a preference with a control of its own next to the control for the
  preferences — the same redundancy `one-git-indicator` closed for the two git
  chips. The chips are the panel's Theme row now; `theming.feature` is the whole
  of what they still promise, and it opens this panel to reach them.

  The Font row is the same shape as Theme: a catalog (`theme/fonts.ts`), an
  attribute on `<html>`, and a hint read off the choice in force. `fonts.feature`
  is the whole of what the select still promises.

  The Done row is the DEFAULT for a per-view switch rather than a second switch.
  This switch belongs to a page — so it starts fresh when you zoom, unlike a
  fold, which is this browser's and is kept (`folds_are_remembered.feature`) —
  but "I do not want to look at finished work" is a claim about the reader, and
  pressing it again on every page opened is what a preference exists to stop.
  Two scenarios below are that distinction: changing it moves the page you are
  on, and it leaves alone a page whose own switch has been pressed.

  Scenario: The preferences open from the header, and say whose they are
    When I open the app
    And I open the preferences
    Then the preferences are open
    And the preferences panel opens downward, clear of the bar
    And the panel says these preferences are this browser's
    And there should be no page errors

  Scenario: A keyboard opens it and is standing inside it
    # THE REGRESSION THIS EXISTS FOR. The theme chips used to be laid out inside
    # the trigger's own box, so they were the next thing in document order and
    # Tab reached them. This panel is portalled to the end of the body, which
    # puts it after the sidebar, the tree and everything else — so opening it
    # and leaving the caret on the trigger means the controls are not reachable
    # in any sense a person would accept.
    #
    # So the trigger and its panel are ONE tab cycle: opening moves the caret
    # into the panel, Shift+Tab goes back out to the trigger, and Tab goes in to
    # the first control.
    When I open the app
    And I focus the preferences trigger
    And I press Enter
    Then the preferences are open
    And the preferences panel has the focus
    When I press Shift+Tab
    Then the preferences trigger has the focus
    When I press Tab
    Then the first control in the preferences has the focus
    When I press Shift+Tab
    Then the preferences trigger has the focus

  Scenario: Tab does not walk out of an open panel
    # The other half of one cycle: the last control leads back to the trigger
    # rather than to the page underneath, which is what a portalled panel would
    # otherwise hand a keyboard.
    When I open the app
    And I open the preferences
    And I press Shift+Tab
    Then the preferences trigger has the focus
    When I press Shift+Tab
    Then the last control in the preferences has the focus

  Scenario: Escape shuts it and hands the keyboard back
    # Somebody who opened this, tabbed into it and pressed Escape would
    # otherwise land on `<body>`, which is nowhere.
    When I open the app
    And I open the preferences
    And I press Escape on the preferences
    Then the preferences are shut
    And the preferences trigger has the focus

  Scenario: The trigger puts it away again
    # The other half of the two-root rule: a press ON the trigger is not a press
    # outside the panel, and reading it as one shuts the panel on the
    # pointerdown for the trigger's own click to reopen — a control that looks
    # like it does nothing. `committing.feature` holds the same claim for the
    # pill beside this, which is where the bug was.
    When I open the app
    And I open the preferences
    And I press the preferences trigger
    Then the preferences are shut
    And the preferences trigger has the focus

  Scenario: A press outside it shuts it
    # The panel is portalled to the body, so it is not a descendant of the
    # control that opened it and neither of them can speak for the other — a
    # click-away that knew about only one root would shut the panel every time
    # somebody pressed a control ON it.
    When I open the app
    And I open the preferences
    And I click the wordmark
    Then the preferences are shut

  Scenario: Done: Hidden takes the finished work off the page you are reading
    # A default that only applied to the NEXT page would be a setting that does
    # nothing when you press it, on a page that is showing exactly what it is
    # about.
    Given I open the outline "house.jsonl"
    Then the node "demo" is shown
    When I set Done to "hidden"
    Then the Done row explains that finished work is "hidden"
    And this browser has stored that done nodes are "hidden"
    And the node "demo" is not shown
    And the node "order" is shown

  Scenario: The hint is read off the choice in force
    Given I open the outline "house.jsonl"
    When I set Done to "hidden"
    Then the Done row explains that finished work is "hidden"
    When I set Done to "visible"
    Then the Done row explains that finished work is "shown"

  Scenario: A page whose own switch has been pressed is left where it was put
    # The per-view switch is not overridden by the preference behind it: it is
    # what the preference is a DEFAULT for, so a page somebody has already
    # spoken about stays as they left it.
    Given I open the outline "house.jsonl"
    When I hide the done nodes
    Then the node "demo" is not shown
    When I set Done to "visible"
    Then the node "demo" is not shown

  Scenario: A page you go to starts on the default again
    # The other half of the one above: what a page's own switch overrides is
    # that page's reading, and a page you have never read has no reading to
    # override with.
    Given I open the outline "house.jsonl"
    When I set Done to "hidden"
    # The panel stays open on a press (a palette is judged by the page it
    # paints), and the page's own switch is behind it.
    And I press Escape on the preferences
    And I show the done nodes
    Then the node "demo" is shown
    When I zoom into the node "kitchen"
    Then the node "demo" is not shown

  Scenario: It is remembered, and it is this browser's
    When I open the app
    And I set Done to "hidden"
    And I reload the page
    Then the Done row explains that finished work is "hidden"

  Scenario: A preference set in another tab lands in this one
    # A preference belongs to the BROWSER, and a browser is more than one tab —
    # which is what `followDoneDefault` is for, and what a reload scenario
    # cannot ask: deleting that line entirely would pass every other Done
    # scenario here. The theme has had this fence since it was written; this is
    # the same one for the second preference, through the same `storage` event.
    Given I open the outline "house.jsonl"
    Then the node "demo" is shown
    When a second tab sets Done to "hidden"
    Then the node "demo" is not shown
    And the Done row explains that finished work is "hidden"
    And there should be no page errors

  Scenario: Setting a preference asks the server for nothing
    # The whole doctrine, as an assertion: a pick is stored in this browser and
    # is never sent. "It works" and "it works without asking anybody" look
    # identical on screen.
    When I open the app
    And I open the preferences
    And I watch what the page asks for
    And I set Done to "hidden"
    Then the page asked for nothing at all
