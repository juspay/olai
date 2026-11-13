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
    # opened — so the freeze arriving over an open palette is the easy half.
    # The hard half is that `client/layer.ts` keeps the freeze the FLOOR of
    # that layer whatever opens next, which is what this leaves honest.
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
