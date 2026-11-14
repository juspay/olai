@corpus:good
Feature: Asking for less motion stills the outline without quieting it
  A reader can tell their system they want less movement — vestibular
  disorders, migraine, or simply a preference — and the browser passes that on
  as `prefers-reduced-motion`. olai answers it in ONE place
  (`@olai/appearance/chrome.css`): spatial transitions stop travelling,
  persistent animations hold still, and smooth scrolling becomes arrival.

  What that answer must NOT do is take anything away. Colour transitions stay
  alive, because a control lighting under the pointer is a cue and not a
  movement; and every state the motion was decorating is still reached, still
  drawn and still readable. A fold that no longer turns is a fold that is
  simply folded.

  The row's chevron is where this is proven, because it is the plainest
  spatial transition in the app and the one a reader meets first. Both arms
  are in the one scenario on purpose: an assertion that nothing animates would
  pass just as happily on a chevron nobody ever animated, so the same reading
  is taken before the preference is set.

  Scenario: A fold lands instead of travelling, and folds either way
    Given I open the outline "house.olai"
    And the node "kitchen" is expanded
    # The control: ordinary motion, and the turn is a real transition.
    Then turning the chevron of "kitchen" animates it
    And the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    When the reader asks for less motion
    # The same press, the same chevron: nothing travels, nothing is running,
    # and the row still does what the press was for.
    Then turning the chevron of "kitchen" animates nothing
    And the node "kitchen" is expanded
    And the children of "kitchen" are shown
    And there should be no page errors
