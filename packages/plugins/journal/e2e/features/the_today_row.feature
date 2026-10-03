Feature: Today is one row, and the month folds under it
  The month used to be always open in the sidebar, drawn as a bright card on
  the dark column — the loudest thing on screen, for a question most visits do
  not ask. Now the journal's doors are two quiet rows: Agenda, and under it
  `Today` with the date. The row goes to today's page, which is where today's
  cell in the month goes. The chevron beside it is a separate button that
  unfolds the month in place and folds it away again, and this browser
  remembers which (`olai.sidebar.calendar`). Shut is the default.

  Everything the month did while it was always open it still does unfolded —
  paging, day links, the marks (journal_and_calendar.feature,
  daily_notes.feature).

  @corpus:journal
  Scenario: The month is folded by default, and Today names the day
    Given I open the outline "work.olai"
    Then the Today row sits directly under Agenda
    And the Today row names today
    And the month is folded under the Today row
    And there should be no page errors

  @corpus:journal
  Scenario: The Today row goes to today's page without unfolding the month
    Given I open the outline "work.olai"
    When I follow the Today row
    Then the day open is today
    And the Today row is the current page
    And the month is folded under the Today row
    And there should be no page errors

  @corpus:journal
  Scenario: The chevron unfolds the month and folds it away again
    Given I open the day "2019-11-05"
    When I press the month's chevron
    Then the month is unfolded under the Today row
    And the month shown is "2019-11"
    And the day "2019-11-05" is the one being read
    When I page the calendar forward
    Then the month shown is "2019-12"
    When I press the month's chevron
    Then the month is folded under the Today row
    And the day open is "2019-11-05"
    And there should be no page errors

  @corpus:journal
  Scenario: The chevron answers the keyboard
    Given I open the outline "work.olai"
    When I press "Enter" on the month's chevron
    Then the month is unfolded under the Today row
    When I press " " on the month's chevron
    Then the month is folded under the Today row

  @corpus:journal
  Scenario: An unfolded month survives a reload, and so does a folded one
    Given I open the outline "work.olai"
    When I press the month's chevron
    Then the month is unfolded under the Today row
    When I reload the page
    Then the month is unfolded under the Today row
    When I press the month's chevron
    And I reload the page
    Then the month is folded under the Today row
    And there should be no page errors

  @corpus:journal @phone
  Scenario: On a phone the Today row and its chevron are a finger's size
    Given I open the day "2019-11-05"
    When I tap the burger
    Then the Today row and its chevron are at least a finger's size
    When I press the month's chevron
    Then the month is unfolded under the Today row
    And the directory drawer is open with a scrim
    When I tap the day "2019-11-06"
    Then the day open is "2019-11-06"

  @corpus:journal
  Scenario: A paged calendar keeps its month across sidebar collapse
    Given I open the day "2019-11-05"
    When I press the month's chevron
    And I page the calendar forward
    Then the month shown is "2019-12"
    When I collapse the sidebar
    And I expand the sidebar from the rail
    Then the month shown is "2019-12"
    And there should be no page errors
