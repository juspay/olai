@scratch:good @git:repo
Feature: Git policy travels with the vault
  The panel reads the git node's properties and names their authors.
  Editing that node re-applies the row for every browser of this serve.

  Background:
    Given I open the outline "garden.olai"

  Scenario: The personal rows are untouched, and still move
    # The fence for a pin that spread. Theme, font, size, notes and done
    # are personal view choices — the reader's or the page's — and no server
    # has anything to say about them: they are live here exactly as they are
    # on an unpinned serve.
    When I open the preferences
    And I set Done to "visible"
    Then the Done row explains that finished work is "shown"
    And this browser has stored done nodes "shown" by default
    When I set Notes to "open"
    Then the Notes row explains that a row "already open"
    And there should be no page errors

  Scenario: The panel names these as this browser's
    When I open the preferences
    Then the panel says these preferences are this browser's
    And there should be no page errors

  Scenario: The git row always names the policy in force
    When I open the plugins panel
    And I open defaults for the plugin "git"
    Then the plugins panel shows "git" configured "commit" as "manual"
    And the plugins panel shows "git" configured "push" as "off"
    And there should be no page errors

  @policy:git.commit=auto
  Scenario: commit: auto is the git row's config on the plugins panel
    When I open the plugins panel
    And I open defaults for the plugin "git"
    Then the plugins panel shows "git" configured "commit" as "auto"
    And the plugin "git" marks "commit" as authored by "vault"
    And the plugins panel shows "git" configured "push" as "off"
    And there should be no page errors

  @policy:git.commit=auto @policy:git.push=off
  Scenario: File policy controls what the commit loop does as well as what it draws
    # This browser has no git preference. The file’s auto policy makes the
    # server record the external edit without a browser action.
    Then this browser has stored nothing about git
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    Then the flurry records itself
    And olai has recorded 1 commit here
    # ... and push: off is honoured too: the commit is made and stays here.
    And there should be no page errors
