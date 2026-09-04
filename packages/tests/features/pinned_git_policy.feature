@scratch:good @git:repo
Feature: Git policy is the instance's, not this browser's
  Committing and pushing are facts about a DIRECTORY: a flag on the command
  line (or the nix module) is the git plugin's pin, the same in every
  browser. There is no runtime door and nothing about git is stored here.
  Theme, font, size, notes and done are personal view choices, and there is
  nothing about them for a server to have an opinion on.

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

  @pin:commit=auto @pin:push=off
  Scenario: The flag is what the loop actually does, not only what it draws
    # THE FENCE FOR A FLAG HONOURED IN THE DRAWING AND NOT IN THE DOING. Nobody
    # has turned anything on in this browser and there is no control here that
    # could — and the flurry still records itself, because the loop the flag
    # armed is the server's.
    Then this browser has stored nothing about git
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    Then the flurry records itself
    And olai has recorded 1 commit here
    # ... and --push=off is honoured too: the commit is made and stays here.
    And there should be no page errors
