@corpus:good
Feature: Notes under the title
  A description that always opens in full is a page of three nodes. Workflowy-
  style, adopted: under the title, one dim plain-text line clamped with an
  ellipsis; there is no density switch, no hover, and no per-place unfold cell.
  Clicking the note expands it in place to the full multi-line desc and the
  see links; clicking it again — or clicking away — collapses back to the one
  clamped line. Touch is the same click. The date badge stays on the title
  line. The zoomed page keeps the full note always.

  Background:
    Given I open the outline "house.olai"

  Scenario: By default a note is one clamped line under the title
    # `order` stores a multi-line markdown note with a list and bold. The
    # preview is the first line as words, under the title, not on it and not
    # as rendered blocks.
    Then the description of "order" is a preview of "Two ways to go:"
    And the description of "order" does not render as markdown blocks
    And the description of "order" is under its title
    And the description of "order" is clamped to one line

  Scenario: Clicking the note expands it in place
    When I click the note of "order"
    Then the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
    And the description of "order" does not show its markdown source
    And the node "order" sees "herbs" as "the herb bed by the door"
    # Clicking the note AGAIN is the caret's now (2026-08-11, human): folding
    # is what clicking away does, which is the scenario below.
    When I click away from the note of "order"
    Then the description of "order" is a preview of "Two ways to go:"
    And the description of "order" does not render as markdown blocks

  Scenario: Clicking away collapses the open note
    When I click the note of "order"
    Then the description of "order" renders bold text "walnut"
    When I click away from the note of "order"
    Then the description of "order" is a preview of "Two ways to go:"

  Scenario: Escape collapses the open note
    # The note shuts by the client's one dismissal (`client/dismiss.ts`), which
    # is a pointer outside it AND Escape — this panel had only the first, for
    # no reason anybody wrote down. It is the model this note already keeps:
    # expanding and editing are one state and you leave both at once
    # (`keyboard_editing.feature`), and Escape has always been how a caret
    # leaves.
    When I click the note of "order"
    Then the description of "order" renders bold text "walnut"
    When I press "Escape"
    Then the description of "order" is a preview of "Two ways to go:"

  Scenario: A zoomed page always shows the subject's note in full
    When I open the node "order"
    Then the zoomed node is "order"
    # The subject is the page: its note is not a clamped line.
    And the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
    And the node "order" shows the date "2026-08-10"

  @phone
  Scenario: On a phone, tapping the note expands it, and again writes in it
    When I tap the note of "order"
    Then the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
    And the node "order" sees "herbs" as "the herb bed by the door"
    # The same two gestures a pointer gets, and the second is what puts a
    # phone's keyboard up.
    When I tap the note of "order"
    Then the note of "order" is being typed
