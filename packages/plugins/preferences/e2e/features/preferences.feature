@corpus:good
Feature: One place to set how this browser reads
  The gear in the app header opens a calm settings pane: rows under headings,
  each row a label and the control that sets it, on one line. A row carries at
  most one short quiet line where its label does not already say what the
  control does, and news (an Allow button, a blocked browser) only while it
  applies. One line at the foot says, once, that all of it is saved in this
  browser only — olai's preferences are client-local
  (`docs/architecture/overview.md`): nothing here is a cell, nothing crosses a
  wire, and nothing is committed.

  THE PANEL KNOWS NO ROW AND NO HEADING. Each plugin contributes its rows to
  `preferences.sections` with the heading they sit under and a place:
  Appearance (theme: Theme, Font, Size), Outlines (outlines: Row density, Show
  finished), Notifications (alerts: Alerts, Sound; journal: Reminders). A
  heading is drawn at its first contribution's place, and a heading whose
  contributors are all switched off is not drawn — `preference_headings.feature`
  is that half.

  There is ONE door. The theme pill used to sit in the bar beside this trigger,
  which was a preference with a control of its own next to the control for the
  preferences — the same redundancy `one-git-indicator` closed for the two git
  chips. The swatches are the panel's Theme row now, with the theme in force
  named beside the label; `theming.feature` is the whole of what they still
  promise, and it opens this panel to reach them. The Font row is the same
  shape — a catalog (`@olai/fonts`) and an attribute on `<html>` — and
  `fonts.feature` is what the select still promises.

  The Size row is the second half of "how this page is set", and it is a root
  font size: every length in this client is a `rem`, so one number moves the
  rows, the gutter and the panels together. It rides the shell's boot script
  beside the theme and the typeface, because a size taken up after the first
  paint would reflow the whole page under somebody who had just opened it.

  Row density is how much of a row is drawn by default — Compact, Cozy,
  Open — and what it moves is `note_density.feature`'s subject. What is here is
  that it is a preference like the others: it moves the page you are on,
  follows you to the next one, is stored in this browser under one BROWSER-wide
  key (not one per outline — "I read a tree as a list of titles" is a claim
  about the reader), and reaches every tab of it.

  Every yes-or-no row is the one shared switch. Show finished is TWO homes of
  one pick: the switch here is the reader's default — off, for a browser that
  never said — and the `finished` box beside an outline's filter is that
  page's out-vote, one stored word a file in either direction (even matching
  the default, which is what lets it outlive a panel flip), gone when the page
  hands it back. What "done" means depends on the page — a roadmap reads as
  "what is next" and finished rows are clutter; a board of the day's lanes
  reads as "what happened" and they are the content — which is why the
  page-side door exists. A zoomed view is the same page and mints no pick of
  its own, and a page the pick was never about — a day, the agenda, the
  trash — has no flip to show at all.

  Alerts gates Sound and Reminders: with Alerts off both are drawn dimmed
  and do not move, rather than hidden — the switch above them says why. The
  Alerts row reads what the browser has said about notifications: not asked
  yet (the one button that can raise the prompt), refused, or unable.

  Scenario: The preferences open from the header, and say whose they are
    When I open the app
    And I open the preferences
    Then the preferences are open
    And the preferences panel opens downward, clear of the bar
    And the preferences are headed "Appearance, Outlines, Notifications"
    And the panel says these preferences are this browser's
    And there should be no page errors

  @phone
  Scenario: On a phone the whole panel fits the screen
    # 390×844 is the handset every `@phone` scenario gets. The panel opens
    # from the drawer's foot and has to fit it: no row, swatch or control
    # past the right edge, no sideways scroll, and a panel taller than the
    # screen scrolls inside itself rather than running off it.
    When I open the app
    And I open the preferences
    Then the preferences panel fits the screen
    And the preferences are headed "Appearance, Outlines, Notifications"
    And there should be no page errors

  Scenario: With Alerts off, Sound and Reminders are dimmed and do not move
    When I open the app
    And I set Alerts to "off"
    Then the "Sound" switch is dimmed and does not move
    And the "Reminders" switch is dimmed and does not move
    And this browser has stored that alerts are "off"
    When I set Alerts to "on"
    Then the "Sound" switch can be set
    And the "Reminders" switch can be set
    When I set the alert sound to "off"
    Then the "Sound" switch reads "off"
    And this browser has stored that the alert sound is "off"
    And there should be no page errors

  Scenario: A browser not yet asked is offered the one gesture that asks
    # Alerts are on by default, so there is no "first enable" press for the
    # browser's prompt to ride — the button is the door that always works,
    # drawn only while it can help: Alerts on, and a browser that has neither
    # granted nor refused.
    Given this browser has not yet been asked about notifications
    When I open the app
    And I open the preferences
    Then the Alerts row offers to allow notifications
    And the Alerts row explains "When the agent needs you"
    When I set Alerts to "off"
    Then the Alerts row offers no way to allow notifications

  @alerts-denied
  Scenario: A browser that refused is told so, and offered nothing it cannot do
    # Once refused, only the browser's own settings can undo it; a button
    # here would do nothing.
    When I open the app
    And I open the preferences
    Then the Alerts row explains "Notifications are blocked in this browser"
    And the Alerts row offers no way to allow notifications

  Scenario: A browser with no notifications at all says so
    Given this browser cannot show notifications
    When I open the app
    And I open the preferences
    Then the Alerts row explains "This browser can't show notifications"
    And the Alerts row offers no way to allow notifications
    And there should be no page errors

  @alerts
  Scenario: A browser that granted has nothing to be told
    When I open the app
    And I open the preferences
    Then the Alerts row explains "When the agent needs you"
    And the Alerts row offers no way to allow notifications

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

  Scenario: Every page hides until one is asked not to, and the ask is the page's own
    # THE DEFAULT (ruled 2026-08-29), and ITS OVERRIDE: finished work waits
    # until somebody says so — and the somebody is the PAGE, speaking beside
    # its own filter (client/filter/DoneFlip.tsx). `demo` is done; `order` is
    # not.
    Given I open the outline "house.olai"
    Then the node "demo" is not shown
    And the node "order" is shown
    When I show the done nodes
    Then this page's Done flip says "shown"
    And the Done flip is this page's own
    And this browser has stored that done nodes are "shown" on "house.olai"
    And the node "demo" is shown

  Scenario: The panel's row is still the door, for the default every page starts from
    # The revision that put the flip on the page kept the row: what a page
    # that never said its own thing answers to. And the page that follows the
    # default marks nothing — "follow" is not a word it stores.
    Given I open the outline "house.olai"
    When I set Done to "visible"
    Then the "Show finished" switch reads "on"
    And this browser has stored done nodes "shown" by default
    And the node "demo" is shown
    And the Done flip is the panel's answer
    And this browser has stored no Done word on "house.olai"
    When I set Done to "hidden"
    Then the "Show finished" switch reads "off"
    And this browser has stored done nodes "hidden" by default

  Scenario: A page can also out-vote a shown default
    # The override word runs BOTH WAYS — shown-under-hidden is why the flip
    # exists, but a map that can only hold one direction is a flag with heirs.
    Given I open the outline "house.olai"
    When I set Done to "visible"
    And I press Escape on the preferences
    Then the node "demo" is shown
    When I hide the done nodes
    Then the node "demo" is not shown
    And this page's Done flip says "hidden"
    And the Done flip is this page's own
    And this browser has stored that done nodes are "hidden" on "house.olai"
    And this browser has stored done nodes "shown" by default

  Scenario: Each page keeps its own pick
    # THE FEATURE, in two files: `house.olai` shows its finished work because
    # it was asked to; `garden.olai` has never been asked and hides by
    # default. And going back finds the first pick still where it was made —
    # the failure this fences is the reader-wide switch of old, which would
    # have moved the roadmap's reading when the board was flipped.
    Given I open the outline "house.olai"
    When I show the done nodes
    And I open the outline "garden.olai"
    Then the node "basil" is not shown
    And the Done flip is the panel's answer
    When I open the outline "house.olai"
    Then the node "demo" is shown
    And this browser has stored that done nodes are "shown" on "house.olai"
    And this browser has stored no Done word on "garden.olai"

  Scenario: Two panes read their two picks at the same moment
    # The one shape this design can break in, on one screen: pruning per FILE
    # while two files are drawn, and the flip answering to the FOCUSED pane.
    # A sequential walk (the scenario above) passes even with one pick stored
    # under two names; this cannot. The opening shows rows that MUST be there
    # (each pane has settled its tree) before it claims absences — a pane
    # still landing would make the same claims vacuously.
    Given I open the address "/s/house.olai/garden.olai"
    Then the node "kitchen" is shown in pane 0
    And the node "mint" is shown in pane 1
    And the node "demo" is not shown in pane 0
    And the node "basil" is not shown in pane 1
    When I focus pane 0
    And I show the done nodes
    Then this page's Done flip says "shown"
    And the node "demo" is shown in pane 0
    # THE SAME NODE, TWO ANSWERS, ONE MOMENT: `basil` under house.olai's
    # mirror is read with house.olai's pick — which page its row STANDS in is
    # the whole clause.
    And the node "basil" is shown in pane 0
    And the node "basil" is not shown in pane 1
    When I focus pane 1
    And I show the done nodes
    Then this page's Done flip says "shown"
    And the node "basil" is shown in pane 1

  Scenario: A zoom is the same page, and mints no second pick
    # `Hiding done nodes works on a zoomed page too` in zoom_and_navigate is
    # the tree filter on a page opened first; this one is where the pick
    # comes FROM: the zoom reads the outline's word, the flip says so, and
    # pressing it there writes the outline's entry and nothing else.
    Given I open the outline "house.olai"
    When I show the done nodes
    Then the node "demo" is shown
    When I zoom into the node "kitchen"
    Then the node "demo" is shown
    And this page's Done flip says "shown"
    When I hide the done nodes
    Then the node "demo" is not shown
    And this browser has stored that done nodes are "hidden" on "house.olai"

  Scenario: The page's reset hands the pick back to the panel
    # The release door is `reset` — not a second press of the box (the
    # box's asks are idempotent: pressing what the pick already is means
    # what it says, and it means it twice the same way). After the hand back,
    # the word the page answers to is the panel's own, and the ask survives
    # no further — the map keeps no entry for what follow already IS.
    Given I open the outline "house.olai"
    When I show the done nodes
    Then the Done flip is this page's own
    When I hand the page's Done pick back to the panel
    Then the Done flip is the panel's answer
    And the node "demo" is not shown
    And this browser has stored no Done word on "house.olai"

  Scenario: The finished box follows the default until the page says otherwise, and reset returns to it
    # THE THREE STATES ON ONE BOX: following (no reset, the tooltip names the
    # default), the page's own word (a reset, the tooltip names both), and
    # following again. The default moving under a page that holds its own word
    # does not move the page.
    Given I open the outline "house.olai"
    Then the finished box is named "Show finished"
    And this page's Done flip says "hidden"
    And the finished box offers no reset
    And the finished box's tooltip says "Finished items hidden, as your default."
    When I set Done to "visible"
    And I press Escape on the preferences
    Then this page's Done flip says "shown"
    And the node "demo" is shown
    And the finished box offers no reset
    When I hide the done nodes
    Then the node "demo" is not shown
    And the Done flip is this page's own
    And the finished box's tooltip says "Finished items hidden here. Your default: shown."
    When I set Done to "hidden"
    And I press Escape on the preferences
    Then this page's Done flip says "hidden"
    And the Done flip is this page's own
    When I set Done to "visible"
    And I press Escape on the preferences
    And I hand the page's Done pick back to the panel
    Then the Done flip is the panel's answer
    And this page's Done flip says "shown"
    And the node "demo" is shown
    And the finished box offers no reset
    And this browser has stored no Done word on "house.olai"
    And there should be no page errors

  @phone
  Scenario: On a phone the filter and the finished box fit one line
    Given I open the outline "house.olai"
    Then the filter and the finished box share one line
    When I show the done nodes
    Then the node "demo" is shown
    And the filter and the finished box share one line
    And there should be no page errors

  Scenario: Asking the box for what the page ALREADY SHOWS while the page follows says nothing
    # The pin case, in the negative: `demo` is done, `house.olai` follows the
    # default and the box already stands clear — asking for hidden is not a
    # way to pin the page at the word the panel already says: storage stays
    # silent, and the mark stays off.
    Given I open the outline "house.olai"
    Then the Done flip is the panel's answer
    When I hide the done nodes
    Then the node "demo" is not shown
    And this page's Done flip says "hidden"
    And the Done flip is the panel's answer
    And this browser has stored no Done word on "house.olai"

  Scenario: It is remembered, and it is this browser's
    # THE PIN FOR THE BOOT READ: the write is fenced by the stored-key steps
    # above; this one is that the first read after a reload honours the entry.
    Given I open the outline "house.olai"
    When I show the done nodes
    Then the node "demo" is shown
    When I reload the page
    Then this browser has stored that done nodes are "shown" on "house.olai"
    And this page's Done flip says "shown"
    And the node "demo" is shown

  Scenario: A preference set in another tab lands in this one
    # A preference belongs to the BROWSER, and a browser is more than one tab —
    # which is what `followDonePrefs` is for, and what a reload scenario
    # cannot ask: deleting that line entirely would pass every other Done
    # scenario here. The theme has had this fence since it was written; this is
    # the same one for this pick, through the same `storage` event — on the
    # SAME page, because that is what a page's word is about.
    Given I open the outline "house.olai"
    Then the node "demo" is not shown
    When a second tab shows the done on this page
    Then the node "demo" is shown
    And there should be no page errors

  Scenario: A page the pick does not reach offers no flip
    # A day is a record of what happened — finished work is the content there,
    # never something to hide — so the question the flip answers is not one
    # this page holds. "There is no pick in force" is drawn as NO CONTROL,
    # not a frozen one: the filter bar keeps the rest of its say.
    Given I open the day "2026-08-03"
    Then this page offers no Done flip

  # ── how much of a row is drawn ───────────────────────────────────────

  Scenario: Row density moves the page you are reading, and is remembered
    Given I open the outline "house.olai"
    Then the row "order" is folded
    When I set Notes to "open"
    Then the "Row density" row is set to "open"
    And this browser has stored that notes are "open"
    And the row "order" is open
    When I reload the page
    Then this browser has stored that notes are "open"
    And the row "order" is open

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
