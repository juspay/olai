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

  The Font row is the same shape as Theme: a catalog (`@olai/fonts`), an
  attribute on `<html>`, and a hint read off the choice in force. `fonts.feature`
  is the whole of what the select still promises.

  The Size row is the second half of "how this page is set", and it is a root
  font size: every length in this client is a `rem`, so one number moves the
  rows, the gutter and the panels together. It rides the shell's boot script
  beside the theme and the typeface, because a size taken up after the first
  paint would reflow the whole page under somebody who had just opened it.

  The Notes row is how much of a row is drawn by default — Compact, Cozy,
  Open — and what it moves is `note_density.feature`'s subject. What is here is
  that it is a preference like the others: it moves the page you are on,
  follows you to the next one, is stored in this browser under one BROWSER-wide
  key (not one per outline — "I read a tree as a list of titles" is a claim
  about the reader), and reaches every tab of it.

  Its three words need saying out loud, which is why one scenario below is
  about the HINT rather than about the tree: Cozy is the shape every row had
  before the fold existed, Open goes one step further than anything that did,
  and Compact — the default, because a fold whose default is the old behaviour
  is a feature nobody discovers — is the title alone.

  The Editing row is the newest of them and the only one that is about a
  KEYBOARD rather than about what a page draws: whether this browser's markdown
  editors are vim editors. It is off until somebody says otherwise — an editor
  that swallows every letter you type is indistinguishable from a broken one —
  and what it moves is `live_preview_editing.feature`'s subject. What is here
  is that it is a preference like the others.

  The Done row is the one switch. The floating pill that sat above the outline
  was a second door for the same preference — the same redundancy the theme
  pill used to be, and the same one `one-git-indicator` closed for the two git
  chips. Prefs is the home; there is no per-page override. A pick moves the
  page you are on, follows you onto a page you have not opened, and reaches
  every other tab of this browser.

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
    Given I open the outline "house.olai"
    Then the node "demo" is shown
    When I set Done to "hidden"
    Then the Done row explains that finished work is "hidden"
    And this browser has stored that done nodes are "hidden"
    And the node "demo" is not shown
    And the node "order" is shown

  Scenario: The hint is read off the choice in force
    Given I open the outline "house.olai"
    When I set Done to "hidden"
    Then the Done row explains that finished work is "hidden"
    When I set Done to "visible"
    Then the Done row explains that finished work is "shown"

  Scenario: There is one switch, and it moves the page you are on
    # THE FENCE FOR A REINTRODUCED OVERRIDE. The pill used to leave a page
    # somebody had already spoken about; this ends with demo SHOWN after Prefs
    # says visible, which is the inverse of the old pin. Hide/show-and-come-back
    # in zoom_and_navigate is the tree filter; this one is that Prefs is the
    # only circuit.
    Given I open the outline "house.olai"
    When I hide the done nodes
    Then the node "demo" is not shown
    When I set Done to "visible"
    Then the node "demo" is shown

  Scenario: The preference follows you onto a page you have not opened
    # A pick is the reading of every page, including one you zoom into next.
    # `Hiding done nodes works on a zoomed page too` is the same filter on a
    # page you opened first; this one is that zooming does not start a new
    # reading.
    Given I open the outline "house.olai"
    When I set Done to "hidden"
    And I press Escape on the preferences
    Then the node "demo" is not shown
    When I zoom into the node "kitchen"
    Then the node "demo" is not shown

  Scenario: It is remembered, and it is this browser's
    # THE PIN FOR THE BOOT READ. Prefs writes olai.done.hidden on
    # createPreference; the write itself is already fenced by
    # "this browser has stored" on the hide scenario above (a line master
    # shipped). This one is that the first read after a reload honours that
    # key. Sabotage: apply the default at module load and leave the write
    # and the follow alone (`pref.set(SHOWN, { persist: false })` after the
    # factory). That reddens this scenario and nothing else.
    Given I open the outline "house.olai"
    Then the node "demo" is shown
    When I set Done to "hidden"
    Then the node "demo" is not shown
    When I reload the page
    Then this browser has stored that done nodes are "hidden"
    And the Done row explains that finished work is "hidden"
    And the node "demo" is not shown

  Scenario: A preference set in another tab lands in this one
    # A preference belongs to the BROWSER, and a browser is more than one tab —
    # which is what `followDoneHidden` is for, and what a reload scenario
    # cannot ask: deleting that line entirely would pass every other Done
    # scenario here. The theme has had this fence since it was written; this is
    # the same one for the second preference, through the same `storage` event.
    Given I open the outline "house.olai"
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

  # ── how much of a row is drawn ───────────────────────────────────────

  Scenario: Notes moves the page you are reading, and is remembered
    Given I open the outline "house.olai"
    Then the row "order" is folded
    When I set Notes to "open"
    Then the Notes row explains that a row "already open"
    And this browser has stored that notes are "open"
    And the row "order" is open
    When I reload the page
    Then this browser has stored that notes are "open"
    And the row "order" is open

  Scenario: A density set in another tab lands in this one
    # A preference belongs to the BROWSER, and a browser is more than one tab —
    # the same `storage` event the theme and the done preference ride, which a
    # reload scenario cannot ask about: deleting `followDensity` would pass
    # every other Notes scenario here.
    Given I open the outline "house.olai"
    Then the row "order" is folded
    When a second tab sets Notes to "open"
    Then the row "order" is open
    And there should be no page errors

  # ── how big the page is set ──────────────────────────────────────────

  Scenario: The page is set a notch above the browser's own size by default
    # 18px rather than 16 (human: "I find the text to be too cramped"). Read as
    # the pixels a reader actually gets, so this reddens if the sheet's blocks
    # and the boot script's attribute ever stop meeting.
    When I open the app
    Then the page is set at "18px"

  Scenario: Picking a size sets the whole page, and is remembered
    Given I open the outline "house.olai"
    When I set Size to "medium"
    Then the page is set at "16px"
    And this browser has stored the size "medium"
    When I set Size to "larger"
    Then the page is set at "20px"
    When I reload the page
    # THE PIN FOR THE BOOT READ. The shell's inline script puts the stored size
    # on `<html>` while the document is still parsing, so the first paint is
    # already at it — a size taken up by the bundle instead would reflow every
    # line under a reader who had just opened the page.
    Then the page is set at "20px"
    And this browser has stored the size "larger"

  Scenario: Each Notes mode says what you get, not what it is called
    # THE FENCE FOR A QUIZ. Three adjectives on a segmented strip say which one
    # is pressed and nothing about what the page will now do — and two of the
    # three need saying out loud, because a reader arriving after the fold has
    # no way to know which of them is the shape olai used to have. Cozy names
    # itself as that shape; Open says it is about notes NOBODY HAS FOLDED, which
    # is the difference between a default and a lock.
    Given I open the outline "house.olai"
    When I set Notes to "cozy"
    Then the Notes row explains that a row "before this switch existed"
    When I set Notes to "open"
    Then the Notes row explains that a row "you have not folded yourself"
    When I set Notes to "compact"
    Then the Notes row explains that a row "A row is its title"
