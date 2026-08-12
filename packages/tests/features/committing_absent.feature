Feature: What the Commit pill says when there is nothing to record
  The pill is never absent, and these are the two states where that matters
  most. Both are SETTINGS rather than faults — a directory of notes under a
  sync folder is not olai's business, and neither is a server somebody started
  with commits off — so both are dim and inert, with no warning: `⚠` is
  reserved for the one state a person can act on.

  Saying nothing at all would be the failure this rule exists to prevent. The
  feature is an audit trail; "there is no audit trail here" is the single most
  important thing it can report, and a control that disappeared is exactly how
  a person would never find that out.

  @corpus:good
  Scenario: A server started with commits off says so
    Given I open the outline "garden.jsonl"
    Then the commit pill says "off"
    And the commit pill cannot be pressed
    And there should be no page errors

  @scratch:good @git:none
  Scenario: A directory that is not a git work tree says so
    Given I open the outline "garden.jsonl"
    Then the commit pill says "no-repo"
    And the commit pill cannot be pressed
    And there should be no page errors
