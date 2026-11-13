@corpus:good
Feature: The reader's own screen, when it is not ours to paint
  Two preferences arrive from the operating system and neither is about the
  theme row that owns the sheet answering them. Windows High Contrast
  (`forced-colors`) TAKES olai's palette away — every author colour is replaced
  from the reader's own small set, and `box-shadow` is deleted outright.
  `prefers-contrast: more` leaves the palette alone and asks for the quiet
  parts of it to stop being quiet.

  THE FOCUS RING IS THE ONE THAT MATTERED MOST, because for a long time it was
  drawn twice and the second one would not have survived. Fourteen controls
  spelled a `focus-visible:ring-2` of their own beside a
  `focus-visible:outline-none`, and neither did what it looked like: the
  `outline-none` never stood the app's ring down (`@olai/appearance/chrome.css`
  is unlayered and Tailwind's utilities are not, and layer order is settled
  before specificity), while the ring they drew was a `box-shadow` — the one
  kind of focus indicator High Contrast removes. The rings are gone now and the
  app's single `outline` is the ring, which is why this scenario reads a
  COMPUTED outline off whatever has the caret rather than any class.

  A SWITCH IS WHERE THE SECOND KIND OF LOSS SHOWS. Its two states were a
  background apart and its knob was a pale disc over a shadow, so a forced
  palette flattened the track, the knob and the shadow into the same `Canvas`:
  on and off became one drawing. Both arms are read here — the page's own
  colours and the screen's — because an assertion that two states differ is
  the easiest green in testing on a control nobody broke.

  AND THE OVERFLOW BAR IS DELIBERATELY QUIET, a quarter of the surface's ink,
  which cannot meet 3:1 against the paper it floats on. That is a trade a
  reader is allowed to refuse: under `prefers-contrast: more` the thumb becomes
  the full ink of whichever palette is in force — not a black written into the
  sheet, which would be a stranger on five of the six.

  Scenario: Forcing the screen's colours keeps the ring and the switch
    When I open the app
    And I open the preferences
    And I Tab to the "basalt" swatch
    # The control arm for the ring, in olai's own palette: a ring that was
    # never drawn at all would pass the second arm just as happily. Read
    # before anything is pressed, because a press is a POINTER and a pointer
    # asks for no ring.
    Then the caret's control wears a visible focus ring
    When I note the focus ring
    And the screen forces its own colours
    # Still two pixels and still painted — in a colour the SCREEN chose, which
    # is also what proves the emulation reached the page.
    Then the focus ring is still drawn, in the screen's own colour
    # The switch's own two arms, in the other order: on and off are a
    # background apart, and the background is the thing this mode takes.
    And the switch in the preferences tells its two states apart
    When the screen uses the page's colours
    Then the switch in the preferences tells its two states apart
    And there should be no page errors

  Scenario: Asking for more contrast strengthens the overflow bar
    When I open the app
    And I note the scrollbar
    And the reader asks for more contrast
    Then the scrollbar thumb is drawn in the page's full ink
    And there should be no page errors
