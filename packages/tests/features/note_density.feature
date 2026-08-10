@corpus:good
Feature: Note density
  A description that always opens in full is a page of three nodes. Workflowy's
  answer, adopted: by default a note is one dim truncated plain-text line; the
  full markdown is the node's own zoomed page and a click that REPLACES the
  preview with the body (never stacks both); and a per-view switch cycles
  full / first-line / hidden.

  Background:
    Given I open the outline "house.jsonl"

  Scenario: By default a note is one plain-text line
    # `order` stores a multi-line markdown note with a list and bold. The
    # preview is the first line as words, not the rendered blocks.
    Then the description of "order" is a preview of "Two ways to go:"
    And the description of "order" does not render as markdown blocks

  Scenario: Expanding replaces the preview — the first line is not shown twice
    When I unfold the note of "order"
    Then the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
    And the description of "order" does not show its markdown source
    # The bug: open used to keep the preview button above the body, so
    # "Two ways to go:" printed twice. Expanded is the body alone.
    And the description of "order" shows the first line "Two ways to go:" exactly once
    When I fold the note of "order"
    Then the description of "order" is a preview of "Two ways to go:"
    And the description of "order" does not render as markdown blocks

  Scenario: A zoomed page always shows the subject's note in full
    When I open the node "order"
    Then the zoomed node is "order"
    # Density is first-line by default, but the subject is the page: its note
    # is not densified.
    And the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items

  Scenario: The density switch shows every note in full
    When I set note density to "full"
    Then the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items

  Scenario: The density switch hides every note
    When I set note density to "hidden"
    Then the node "order" shows no description

  Scenario: The density switch cycles first-line, full, and hidden
    Then the note density is "first-line"
    When I set note density to "full"
    Then the note density is "full"
    When I set note density to "hidden"
    Then the note density is "hidden"
    When I set note density to "first-line"
    Then the note density is "first-line"
    And the description of "order" is a preview of "Two ways to go:"
