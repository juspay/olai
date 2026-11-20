@scratch:good @share-scratch
Feature: The personal books the audit read, drawn as a journal
  `money/personal.journal` is the audit's realistic sample — a quarter of a
  household's books: 47 transactions across July, August and September 2026,
  four commodities, amounts written with thousands grouping, a cost
  annotation, a balance assertion, comments drawn as prose with tag pills,
  virtual postings, and an account tree three levels deep.

  Every fact below is read off the file rather than hand-waved: the counts, the
  bands, the amounts and the totals are the file's own.

  Background:
    Given the ledger fixtures are served

  Scenario: The month bands are the months the file holds
    When I open the address "/money/personal.journal"
    Then the document open is "money/personal.journal"
    And the ledger is showing the "transactions" view
    And the ledger header counts 47 transactions and 48 accounts
    And the ledger header spans "Jul 1 – Sep 30, 2026"
    And the ledger header lists the commodities "$ EUR INR VTI"
    And the ledger month bands are "2026-07, 2026-08, 2026-09"
    And the ledger month "2026-07" is named "July 2026" with 14 transactions
    And the ledger month "2026-08" is named "August 2026" with 17 transactions
    And the ledger month "2026-09" is named "September 2026" with 16 transactions
    And the ledger draws 47 transactions
    And the ledger transaction 1 is dated "2026-07-01"
    And the ledger transaction 14 is dated "2026-07-28"
    And the ledger transaction 15 is dated "2026-08-01"
    And the ledger transaction 31 is dated "2026-08-28"
    And the ledger transaction 32 is dated "2026-09-01"
    And the ledger transaction 47 is dated "2026-09-30"
    And the ledger transaction 1 draws the date "Jul 01"
    And the ledger amounts line up on their last digit
    And there should be no page errors

  Scenario: Amounts are drawn with the digits the file wrote
    When I open the address "/money/personal.journal"
    And the ledger transaction 1 posting 1 reads "assets:bank:hdfc:checking | $4,250.00 | false"
    And the ledger transaction 1 posting 2 reads "assets:bank:hdfc:savings | $12,000.00 | false"
    And the ledger transaction 41 posting 1 reads "expenses:food:dining:restaurants | 1,240.00 INR | false"
    And there should be no page errors

  Scenario: A cost and a balance assertion are drawn as the file wrote them
    When I open the address "/money/personal.journal"
    And the ledger transaction 29 posting 1 reads "assets:investments:brokerage:VTI | 5 VTI | false"
    And the ledger transaction 29 posting 1 shows the cost "@ $271.12"
    And the ledger transaction 47 posting 1 reads "assets:bank:hdfc:checking | $0 | false"
    And the ledger transaction 47 posting 1 shows the assertion "= $5,123.45"
    And the ledger transaction 47 posting 2 reads "equity:adjustments | $0 | true"
    And the ledger transaction 47 posting 2 carries the inferred mark
    And there should be no page errors

  Scenario: Balances carry a column per commodity and the file's own digits
    When I open the address "/money/personal.journal"
    And I switch the ledger to the "balances" view
    And I set the ledger balance depth to "all"
    And the ledger balances head the commodities "$, EUR, INR, VTI"
    And the ledger balance for "assets:bank:hdfc:checking" shows "8,326.20" in "$"
    And the ledger balance for "assets:bank:hdfc:savings" shows "10,756.73" in "$"
    And the ledger balance for "assets:bank:wise:eur" shows "813.80" in "EUR"
    And the ledger balance for "assets:cash:wallet" shows "1,260.00" in "INR"
    And the ledger balance for "assets:investments:brokerage:VTI" shows "5" in "VTI"
    And the ledger balance for "equity:adjustments" has no total
    And there should be no page errors

  Scenario: The tree folds, unfolds, and the depth control hides what is under it
    When I open the address "/money/personal.journal"
    And I switch the ledger to the "balances" view
    And I set the ledger balance depth to "all"
    And the ledger balances draw 48 rows
    When I collapse the ledger balance for "assets:bank:hdfc"
    Then the ledger balance for "assets:bank:hdfc" is collapsed
    And the ledger balance for "assets:bank:hdfc:checking" is not drawn
    And the ledger balances draw 46 rows
    When I expand the ledger balance for "assets:bank:hdfc"
    Then the ledger balance for "assets:bank:hdfc" is expanded
    And the ledger balance for "assets:bank:hdfc:checking" is drawn
    And the ledger balances draw 48 rows
    When I set the ledger balance depth to "3"
    Then the ledger balance for "assets:bank:hdfc" is drawn
    And the ledger balance for "assets:bank:hdfc:checking" is not drawn
    When I set the ledger balance depth to "1"
    Then the ledger balance for "assets" is drawn
    And the ledger balance for "assets:bank" is not drawn
    And the ledger balances draw 6 rows
    And there should be no page errors

  Scenario: The chevron tells the truth at the depth control's cut, and overrules it
    When I open the address "/money/personal.journal"
    And I switch the ledger to the "balances" view
    Then the ledger balance for "assets" is expanded
    And the ledger balance for "assets:bank" is collapsed
    And the ledger balance for "assets:bank:hdfc" is not drawn
    When I expand the ledger balance for "assets:bank"
    Then the ledger balance for "assets:bank" is expanded
    And the ledger balance for "assets:bank:hdfc" is drawn
    And the ledger balance for "assets:bank:hdfc:checking" is not drawn
    When I collapse the ledger balance for "assets:bank"
    Then the ledger balance for "assets:bank:hdfc" is not drawn
    And there should be no page errors

  @phone
  Scenario: A phone draws the day on the payee's line and sets transactions apart
    When I open the address "/money/personal.journal"
    Then the ledger transaction 1 opens with the day "01"
    And the ledger transaction 2 opens with the day "01"
    And the ledger transactions are set apart
    And the ledger postings keep a gap between the account and the amount
    And the ledger inferred mark rides the amount
    And the ledger annotations sit under the amount
    And the ledger header never opens a line with a separator
    And the ledger header facts each stay on one line
    And there should be no page errors
