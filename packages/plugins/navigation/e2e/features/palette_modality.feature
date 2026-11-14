@corpus:good
Feature: The palette is a modal the browser owns
  The ⌘K palette and the keyboard-shortcuts sheet it opens used to be `fixed`
  boxes with `role="dialog"` on them, a hand-written Tab trap, a full-screen
  button for a scrim, and a page underneath that was covered but never inert.
  Every one of those is something the platform does better: they are native
  `<dialog>`s opened with `showModal()` now
  (`navigation/src/palette/Palette.tsx`).

  What that is worth is four promises this feature holds, because each of them
  was previously a line of code that could rot: the page behind really cannot
  be touched, the keyboard cannot leave the panel and goes back where it came
  from, a press outside puts it away and a press inside does not, and the one
  thing that may stand OVER it — the offline freeze — still does.

  Background:
    Given I open the outline "house.olai"

  Scenario: The page behind an open palette cannot be reached
    # `showModal` makes the rest of the document inert: no hit testing, no
    # focus, no tab stop. Four probes in one scenario, because they are four
    # readings of one fact and a scenario per probe would be four openings of
    # the same panel — what lands at a point over the page, whether the thing
    # at that point can be given the caret at all, whether Tab can walk out of
    # the panel, and what a real press aimed past it actually reaches.
    When I press the palette shortcut
    Then the command palette is open
    And the page behind the palette is out of reach
    When I press where the filter box is
    # The press landed on the backdrop — which is both why the palette went
    # and why the box it was aimed at never heard it.
    Then the command palette is closed
    And the filter box never took the caret

  Scenario: Escape gives the keyboard back to where it came from
    # Nothing in the palette arranges this any more. A modal dialog hands the
    # caret back to whatever held it when the dialog opened, which is exactly
    # what the hand-written `previousFocus` used to do by hand and got wrong
    # the day somebody navigated away.
    When I type "kitchen" into the filter box
    And I press the palette shortcut
    Then the command palette is open
    When I press "Escape"
    Then the command palette is closed
    And the keyboard is back in the filter box

  Scenario: A press inside the sheet stays, a press outside puts it away
    # The pointer half of light dismiss, both ways round. `closedby="any"` is
    # not in Safari, so a fallback measures the POINTER'S POSITION against the
    # sheet's own rectangle (`client/dismiss.ts`): the naive version compares
    # `event.target` instead and puts the panel away when somebody presses its
    # padding or the gap between two of its rows.
    When I press the palette shortcut
    And I press the palette's own edge
    Then the command palette is open
    When I press the palette scrim
    Then the command palette is closed

  Scenario: The freeze still covers an open palette, and the palette survives it
    # TWO MODAL DIALOGS, and the order they stack in is the order they were
    # opened — so the freeze arriving over an open palette has to cover it,
    # and the palette has to survive being covered. The other order is the
    # scenario below, and it cannot happen at all.
    When I press the palette shortcut
    Then the command palette is open
    When the browser goes offline
    Then the app is frozen under the offline overlay
    And the palette is sealed under the offline overlay
    When the browser comes back online
    Then the overlay is gone
    # The palette was never closed, so it is still the modal underneath — and
    # the caret comes back to its box, which is where the freeze found it.
    And the command palette is open
    And the palette box has the caret

  Scenario: A row that navigates hands nothing back
    # THE ONE CLOSE THAT MUST NOT RETURN THE CARET. A modal dialog hands the
    # keyboard to whatever had it when it opened, and here that is a row's own
    # editor on the page the reader is leaving: putting the caret back there
    # re-opens an editor nobody asked for and, worse, the parked row clears
    # the page's selection on the way in — so the destination the palette just
    # revealed ends up selected by nothing. The palette takes the keyboard off
    # the invoker BEFORE it opens and gives it back itself, on the closes that
    # did not move the reader (`palette/Palette.tsx`'s `handBack`).
    When I click the title of "handles"
    And I press "Enter"
    Then a new row is being typed
    When I press the palette shortcut
    And I type "hinges" into the palette
    And I pick the palette item "hinges"
    Then the unified destination row "hinges" is selected
    And the caret is not back in the row editor

  Scenario: The shortcuts sheet is a modal of its own
    # It opens from the palette, so it was the surface most likely to inherit
    # a half-modality: covered but reachable, or dismissable only by its own
    # scrim. The same three readings the palette gets, and both ways out.
    When I press the palette shortcut
    And I pick the palette item "Keyboard shortcuts"
    Then the shortcuts are showing
    And the page behind the shortcuts sheet is out of reach
    When I press outside the shortcuts sheet
    Then the shortcuts are put away

  Scenario: The sheet gives the caret back to where the reader came from
    # TWO MODALS IN A ROW, and the hand-back has to survive the handover: the
    # sheet is asked for from inside the palette, whose box unmounts a moment
    # later. So the palette closes FIRST and puts the caret back in the filter
    # box, and only then does the sheet open and record that box as its own
    # hand-back — which is what Escape on the sheet returns to.
    When I type "kitchen" into the filter box
    And I press the palette shortcut
    And I pick the palette item "Keyboard shortcuts"
    Then the shortcuts are showing
    When I press "Escape"
    Then the shortcuts are put away
    And the keyboard is back in the filter box

  Scenario: There is no door at all while the wire is dead
    # THE REVERSE ORDER, and the answer is that it cannot arise: the freeze
    # swallows every chord for as long as it is up (`connection/Offline.tsx`),
    # so a ⌘K pressed at a frozen app never reaches navigation and there is no
    # second modal to stand anywhere. The page stays the freeze's, and the
    # chord works again the moment the wire does.
    When the browser goes offline
    Then the app is frozen under the offline overlay
    When I press the palette shortcut
    Then the command palette does not open
    And the app is frozen under the offline overlay
    When the browser comes back online
    Then the overlay is gone
    When I press the palette shortcut
    Then the command palette is open
    And the palette box has the caret

  Scenario: Without `closedby`, the fallback answers the same three ways
    # Safari has no `closedby`, so for half this app's floor the light
    # dismiss is the hand-written one in `client/dismiss.ts` — and the suite
    # runs on Chromium, where every press below would otherwise be answered by
    # the engine and the fallback would never run at all. The property is
    # taken away so it does.
    Given this browser has no light dismiss of its own
    When I press the palette shortcut
    And I press the palette's own edge
    Then the command palette is open
    When I drag from inside the palette onto the scrim
    Then the command palette is open
    When I press the palette scrim
    Then the command palette is closed

  @scratch:good
  Scenario: Without `closedby`, a press outside answers the question first
    # A light dismiss is a CLOSE REQUEST, not a close: the dismissal stack
    # inside the panel gets it first, exactly as Escape does. The fallback
    # therefore asks — it dispatches a cancelable `cancel` — rather than
    # calling `close()` and taking the whole palette away with a question
    # still standing in it.
    Given this browser has no light dismiss of its own
    And I open the node "install"
    When I press the palette shortcut
    And I choose "Move to Trash" from the palette
    Then the palette asks "Move “install the cabinets” and the 3 rows under it to Trash? You can put them back from Trash in the sidebar."
    When I press the palette scrim
    Then the palette is not asking anything
    And the command palette is open
    And "house.olai" holds a node titled "install the cabinets"
