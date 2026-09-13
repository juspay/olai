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
    Then the tool answer contains "../notes/nix-flakes.md"
    And the page reports a dead link to "projects/nix-flakes.md"
    When the terminal agent calls "outlines_read" with:
      """
      {"id":"link-test"}
      """
    Then the tool answer contains "deadLinks"
    And the tool answer contains "../notes/nix-flakes.md"
    When I rewrite "projects/nix-flakes.md" as:
      """
      # Now served
      """
    Then the page has no dead links

  @scratch:good
  Scenario: Document Save reports a clamped percent-encoded target and clears live
    Given I open the document "finishes.md"
    When I start editing the document
    And I retype the document as:
      """
      [missing](../../gone%20away.md#scope)
      """
    And I save the document
    Then the document nudge names "gone away.md"
    And the rendered link to "missing" is marked dead
    When I rewrite "gone away.md" as:
      """
      # Scope
      """
    Then the page has no dead links
