@share-scratch
Feature: Relative links say where nothing is served
  Missing targets are readings of the directory, never refusals of its files.

  @scratch:good
  Scenario: An agent's note names a missing target and clears when it appears
    Given I open the outline "house.olai"
    And a terminal agent is connected to the served directory
    When I rewrite "projects/olai.olai" as:
      """
      {"id":"link-test","ord":"a0","title":"Links"}
      """
    And I rewrite "notes/nix-flakes.md" as:
      """
      # Nix flakes
      """
    And I expand the folder "projects"
    And I open the outline "projects/olai.olai"
    And the terminal agent calls "outlines_desc" with:
      """
      {"id":"link-test","desc":"[x](nix-flakes.md)"}
      """
    Then the tool nudge says "link resolves to nothing served: projects/nix-flakes.md — did you mean `../notes/nix-flakes.md`?"
    And the page reports a dead link to "projects/nix-flakes.md"
    And the dead-link aside says "link resolves to nothing served: projects/nix-flakes.md — did you mean `../notes/nix-flakes.md`?"
    When the terminal agent calls "outlines_read" with:
      """
      {"id":"link-test"}
      """
    Then the tool answer contains "deadLinks"
    And the tool answer contains "../notes/nix-flakes.md"
    When the terminal agent calls "outlines_subtree" with:
      """
      {"file":"projects/olai.olai"}
      """
    Then the tool answer contains "deadLinks"
    When I zoom into the node "link-test"
    Then the page reports a dead link to "projects/nix-flakes.md"
    And the rendered link to "x" is marked dead
    When I rewrite "projects/nix-flakes.md" as:
      """
      # Now served
      """
    Then the page has no dead links

  @scratch:good
  Scenario: Document Save reports a clamped percent-encoded target and clears live
    Given I open the document "finishes.md"
    And a terminal agent is connected to the served directory
    When I start editing the document
    And I retype the document as:
      """
      [missing](../../gone%20away.md#scope)
      """
    And I save the document
    Then the document nudge names "gone away.md"
    And the rendered link to "missing" is marked dead
    When the terminal agent calls "markdown_read" with:
      """
      {"file":"finishes.md"}
      """
    Then the tool answer contains "deadLinks"
    And the tool answer contains "gone away.md"
    When I rewrite "gone away.md" as:
      """
      # Scope
      """
    Then the page has no dead links

  @scratch:good
  Scenario: Code, frontmatter, directories and queries do not invent missing files
    Given I open the outline "house.olai"
    And a terminal agent is connected to the served directory
    When the terminal agent calls "markdown_create" with:
      """
      {"file":"examples.md","text":"---\nexample: '[x](yaml.md)'\n---\n`[x](inline.md)`\n\n```md\n[x](fenced.md)\n```\n\n[here](.) [parent](..) [folder](notes/) [query](?v=1) [live target](finishes.md?v=1#scope)"}
      """
    Then the tool answer omits "nudge"
    When the terminal agent calls "markdown_read" with:
      """
      {"file":"examples.md"}
      """
    Then the tool answer omits "deadLinks"
    When I open the document "examples.md"
    Then the rendered link to "live target" has no dead mark
