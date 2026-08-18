@scratch:good
Feature: A dated node that comes back
  A dated node may carry a REPEAT RULE, and completing it does two things: it
  stamps the node done, as it always did, and it captures the next occurrence
  as a FRESH node on the day the rule names. The journal keeps the honest
  history that way — eleven finished occurrences are eleven records on eleven
  days, where one row whose date kept moving could prove none of them.

  The grammar is small, closed and spelled in the file — `every day`, `every
  week on <weekday>`, `every month`, `every year` — so the picker is a list of
  exactly those rules and there is nothing to type that is not on it. A `.olai`
  is read by people; `0 0 * * 1` says the same thing in a dialect that has to
  be learned.

  The decision that makes the spawn a feature rather than a field lives in the
  PLANNER, so it holds for both doors: the `Complete` this feature presses and
  an agent's `set_done` are the same request. What is driven here is the face a
  person sees.

  The scenarios date their node in 2019 on purpose, like the agenda's fixtures:
  the occurrence a completion makes is then overdue on every day this suite
  will ever run, so the agenda assertion is about the feature rather than about
  the calendar the machine happens to be on.

  `@scratch:` because these write the directory they are served — each scenario
  gets a private copy of it.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  # ── choosing a rule ────────────────────────────────────────────────

  Scenario: Only a dated row is offered a rule, and the menu is the way in
    # Not the menu's policy: the format refuses a rule with no date to repeat
    # FROM, so the entry over an undated row would be an affordance whose only
    # outcome is that refusal — with `Set date…` sitting directly above it.
    When I open the node menu of "install"
    Then the node menu does not offer "Set repeat…"
    When I press "Escape"
    And I open the node menu of "order"
    Then the node menu offers "Set repeat…"
    And the node menu does not offer "Change repeat…"
    When I choose "Set repeat…" from the node menu
    Then the repeat picker is open
    And the repeat picker holds ""
    # …and the menu says NOTHING: an entry answers with what it has to say, and
    # opening a picker has nothing.
    And the node menu of "order" says nothing
    And there should be no page errors

  Scenario: The list a person chooses from IS the format's grammar
    # Ten rules and no eleventh. A hand-written option list would compile,
    # draw, and be refused on send — so the picker reads the vocabulary off
    # the format itself.
    When I open the node menu of "order"
    And I choose "Set repeat…" from the node menu
    Then the repeat picker offers the rules "every day, every week on monday, every week on tuesday, every week on wednesday, every week on thursday, every week on friday, every week on saturday, every week on sunday, every month, every year"
    And the repeat picker offers to "Set repeat"

  Scenario: A chosen rule is written in the words that were chosen
    When I open the node menu of "order"
    And I choose "Set repeat…" from the node menu
    And I pick the repeat rule "every week on monday"
    Then the node "order" shows the repeat rule "every week on monday"
    And "house.olai" holds the node "order" repeating "every week on monday"
    And the repeat picker is closed
    And the page has not reloaded
    And there should be no page errors

  Scenario: The pill on a repeating row is the other way in, and it starts on that rule
    Given I open the node menu of "order"
    And I choose "Set repeat…" from the node menu
    And I pick the repeat rule "every month"
    When I open the repeat picker on "order"
    Then the repeat picker holds "every month"
    # Choosing what is already there would ask the directory for nothing.
    And the repeat picker's button is dead
    When I empty the repeat picker
    Then the repeat picker offers to "Stop repeating"

  Scenario: A repeating row's menu says which of the two it is, and still stops
    Given I open the node menu of "order"
    And I choose "Set repeat…" from the node menu
    And I pick the repeat rule "every month"
    When I open the node menu of "order"
    Then the node menu offers "Change repeat…"
    And the node menu offers "Stop repeating"
    And the node menu does not offer "Set repeat…"
    When I choose "Stop repeating" from the node menu
    Then the node "order" shows no repeat rule
    And "house.olai" holds the node "order" with no repeat rule
    And there should be no page errors

  Scenario: Cancelling and Escape write nothing
    Given I open the node menu of "order"
    And I choose "Set repeat…" from the node menu
    And I pick the repeat rule "every month"
    When I open the repeat picker on "order"
    And I cancel the repeat picker
    Then the repeat picker is closed
    And the node "order" shows the repeat rule "every month"
    When I open the repeat picker on "order"
    And I press "Escape"
    Then the repeat picker is closed
    And the node "order" shows the repeat rule "every month"
    And there should be no page errors

  # ── completing one ─────────────────────────────────────────────────

  Scenario: Completing a repeating row makes the next occurrence
    Given I open the date picker on "order"
    And I pick the date "2019-03-04"
    And I open the node menu of "order"
    And I choose "Set repeat…" from the node menu
    And I pick the repeat rule "every week on monday"
    When I click the title of "order"
    And I press "Control+Enter"
    Then the node "order" has status "done"
    # The completed record keeps its own day, so the day it was finished on
    # still shows it — and the rule has moved on with the occurrence.
    And "house.olai" holds the node "order" dated "2019-03-04"
    And "house.olai" holds the node "order" with no repeat rule
    # STRICTLY after: the next Monday, never the same one back again.
    And "house.olai" holds a node titled "order the new cabinets" dated "2019-03-11" repeating "every week on monday"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Un-doing leaves the occurrence, and re-doing makes no second one
    # The churn edge, and it is structural rather than policed: the rule
    # travelled, so the node that was completed has none left to spawn from.
    Given I open the date picker on "order"
    And I pick the date "2019-03-04"
    And I open the node menu of "order"
    And I choose "Set repeat…" from the node menu
    And I pick the repeat rule "every week on monday"
    When I click the title of "order"
    And I press "Control+Enter"
    Then "house.olai" holds exactly 2 nodes titled "order the new cabinets"
    When I press "Control+Enter"
    Then the node "order" has no status
    And "house.olai" holds exactly 2 nodes titled "order the new cabinets"
    When I press "Control+Enter"
    Then the node "order" has status "done"
    And "house.olai" holds exactly 2 nodes titled "order the new cabinets"
    And there should be no page errors

  Scenario: A dated row with no rule is completed exactly as it always was
    When I click the title of "order"
    And I press "Control+Enter"
    Then the node "order" has status "done"
    And "house.olai" holds exactly 1 node titled "order the new cabinets"
    And there should be no page errors

  # ── where it is drawn ──────────────────────────────────────────────

  Scenario: The agenda shows the occurrence like any other dated node
    # Nothing on that page knows about recurrence: the occurrence is a dated
    # `todo` on a day that has gone, so it is owed exactly as the row before it
    # was. Its pill says something rather than doing something, because the
    # agenda is a query over the whole set drawn read-only.
    Given I open the date picker on "order"
    And I pick the date "2019-03-04"
    And I open the node menu of "order"
    And I choose "Set repeat…" from the node menu
    And I pick the repeat rule "every week on monday"
    When I click the title of "order"
    And I press "Control+Enter"
    And I open the agenda
    Then the "late" days show a node titled "order the new cabinets" on "2019-03-11"
    And the "late" days show a node repeating "every week on monday"
    # …and the node that was finished is on none of it: what happened is a day
    # page's answer, not this one's.
    And the agenda does not list "order"
    And there should be no page errors
