@scratch:good
Feature: Starting a new outline from the sidebar
  An agent could mint an outline — `create_outline` — and a person could not:
  the sidebar listed every file in the directory and offered no way to start
  another. A standing consistency violation rather than a missing feature
  (HACKING.md: "MCP and Web ops must be consistent; never deviate"), and this
  is the door that closes it, beside the one documents already had.

  What is typed is the PATH, because a file's name is its address in this app
  — the sidebar, the URL and every reading of the set call it by it. Nothing in
  the browser judges that path: it goes to the ops layer as it was typed, and
  what comes back for one it will not take is `create_outline`'s own sentence,
  drawn verbatim under the box.

  `@scratch:` because these write the directory they are served.

  Background:
    Given I open the outline "house.jsonl"
    And I mark the page

  Scenario: A new outline is created and opened, and the sidebar lists it
    When I create the outline "plans/next.jsonl" from the sidebar
    Then the address is "/o/plans/next.jsonl"
    And the outline list links to "plans/next.jsonl"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The first row of it is written where the page offers one
    # No seed on the wire, deliberately: an agent's `create_outline` may be born
    # holding a tree, and a person types the first line where it will live —
    # which the empty outline's own page is already the affordance for.
    When I create the outline "plans/next.jsonl" from the sidebar
    And I start the first line
    And I type "buy the tickets"
    And I click away from the editor
    Then "plans/next.jsonl" holds a node titled "buy the tickets"
    And there should be no page errors

  Scenario: A path the set already holds is refused in the op's own words
    When I create the outline "house.jsonl" from the sidebar
    Then the outline creation is refused saying "is already an outline"
    And the address is "/o/house.jsonl"

  Scenario: So is a path that is not a relative `.jsonl`
    # Three rules, one sentence, and it is the planner's — a browser that
    # pre-checked any of them would be a second rule free to disagree with the
    # one an agent meets.
    When I create the outline "../escape.jsonl" from the sidebar
    Then the outline creation is refused saying "is not a relative `.jsonl` path"
    When I create the outline "notes.md" from the sidebar
    Then the outline creation is refused saying "is not a relative `.jsonl` path"

  Scenario: Escape puts the box away and writes nothing
    When I open the new outline box
    And I fill the new outline box with "plans/next.jsonl"
    And I press "Escape"
    Then the new outline box is gone
    And the outline list does not link to "plans/next.jsonl"
