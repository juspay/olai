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
  (https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/reactivity-after-the-flip.md §6) with words on it.

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
    # A route, not a reload: the whole claim is about one document.
    And the page has not reloaded
    And there should be no page errors

  Scenario: A folder chain deep in the tree stays open
    # Three folders deep, so a chain rebuilt from the top is three subtrees
    # gone rather than one.
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
    # No folder in this one, and it is the sharper claim for it: the column
    # keeps every element either way, and what a reader sees is the wash going
    # out and coming back a round trip later.
    Given I open the outline "life.olai"
    And I mark the screen
    When I click the outline "work.olai"
    Then the address is "/work.olai"
    And the current mark moved in one frame
    And the sidebar did not remount
    And there should be no page errors

  Scenario: A second day of a month nobody is standing in
    # The month is stamped on the day being READ (`client/calendar/Calendar.tsx`),
    # so a day that blanked between two clicks took the grid to today's month
    # and back — thirty-odd cells rebuilt twice, and the month's own
    # subscription torn down and re-opened with them, for a click inside one
    # month.
    Given I open the day "2019-11-05"
    And I mark the screen
    When I click the day "2019-11-12"
    Then the day open is "2019-11-12"
    And the month never changed from "2019-11"
    And the sidebar did not remount
    And there should be no page errors
