@corpus:journal
Feature: The chrome holds still while the page changes
  Clicking an entry in the sidebar opens that page in the main pane. It changes
  NOTHING ELSE: the folder the file sits in stays open, the entry that was lit
  goes out in the same frame the new one lights, the month stays on the month
  being read, and the page that was on screen is replaced by the next one
  rather than taken away and rebuilt from nothing.

  None of that can be asserted by reading the page once it has settled — a
  column that folded and relit under the reader settles into exactly the markup
  it started with. So these scenarios MARK the screen first and count what
  survived (`support/probe.ts`), which is the audit's own probe
  (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md §6) with words on it.

  What they are about is one rule: where am I is the ADDRESS's answer and it is
  synchronous. Derived instead from the page the focused pane was answered with
  — which blanks for one round trip on every navigation, because that is what a
  subscription does when its question changes — every one of these went
  `A → nothing → B`, and the sidebar folding and relighting on every click is
  what a reader saw of it.

  The journal corpus, because it is the one with folders that hold more than one
  file (`notes/`, `Daily/2019/11/`) and a month nobody is standing in.

  Scenario: A click inside a folder leaves the tree alone
    Given I open the document "notes/ferry.md"
    And I mark the page
    And I mark the screen
    When I click the document "notes/2019-11-12.md"
    Then the document open is "notes/2019-11-12.md"
    And the sidebar did not remount
    And the folder "notes" stayed open
    And the current mark moved in one frame
    And the page has not reloaded
    And there should be no page errors

  Scenario: A folder chain deep in the tree stays open
    Given I open the document "Daily/2019/11/2019-11-05.md"
    And I mark the screen
    When I click the document "Daily/2019/11/2019-11-08.md"
    Then the document open is "Daily/2019/11/2019-11-08.md"
    And the sidebar did not remount
    And the folder "Daily" stayed open
    And the folder "Daily/2019" stayed open
    And the folder "Daily/2019/11" stayed open
    And there should be no page errors

  Scenario: Walking from one outline to the next moves the mark and nothing else
    Given I open the outline "life.olai"
    And I mark the screen
    When I click the outline "work.olai"
    Then the address is "/work.olai"
    And the current mark moved in one frame
    And the sidebar did not remount
    And there should be no page errors

  Scenario: A second day of a month nobody is standing in
    Given I open the day "2019-11-05"
    And the calendar is open
    And I mark the screen
    When I click the day "2019-11-12"
    Then the day open is "2019-11-12"
    And the month never changed from "2019-11"
    And the sidebar did not remount
    And there should be no page errors
