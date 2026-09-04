@scratch:good @git:repo @plugins:chat,claude,kolu,odu
Feature: The ledger is a plugin
  Git is a row. A serve that does not name it has no pill, no `surface/git/`
  on the wire, and `ops.commit` refuses in words. Writes still land; nobody
  records them. That is "no provider mounted", not `--commit=off`.

  Background:
    Given I open the outline "garden.olai"

  Scenario: A serve that did not name git has no pill, and writes land unrecorded
    Then the header has no git indicator
    When I rewrite "notes.md" as:
      """
      the herb bed needs splitting again
      """
    Then the outline list is shown
    And olai has recorded 0 commits here
    And there should be no page errors
