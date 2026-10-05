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
    # THE HEADER'S FACTS: 47 transactions, 48 accounts, the quarter's span, and
    # the four commodities the file uses.
    And the ledger header counts 47 transactions and 48 accounts
    And the ledger header spans "Jul 1 – Sep 30, 2026"
    And the ledger header lists the commodities "$ EUR INR VTI"
    # THE BANDS name the months in the order the file holds them, each with the
    # count of transactions under it — 14 + 17 + 16 = 47.
    And the ledger month bands are "2026-07, 2026-08, 2026-09"
    And the ledger month "2026-07" is named "July 2026" with 14 transactions
    And the ledger month "2026-08" is named "August 2026" with 17 transactions
    And the ledger month "2026-09" is named "September 2026" with 16 transactions
    # …AND THE TRANSACTIONS BETWEEN THE BANDS are the file's own: the first and
    # last of each month, which says the bands partition the run rather than
    # that three labels drew.
    And the ledger draws 47 transactions
    And the ledger transaction 1 is dated "2026-07-01"
    And the ledger transaction 14 is dated "2026-07-28"
    And the ledger transaction 15 is dated "2026-08-01"
    And the ledger transaction 31 is dated "2026-08-28"
    And the ledger transaction 32 is dated "2026-09-01"
    And the ledger transaction 47 is dated "2026-09-30"
    And there should be no page errors

  Scenario: Amounts are drawn with the digits the file wrote
    When I open the address "/money/personal.journal"
    # GROUPING AS WRITTEN: the opening balances keep the file's thousands
    # separators in the posting's `data-amount`.
    And the ledger transaction 1 posting 1 reads "assets:bank:hdfc:checking | $4,250.00 | false"
    And the ledger transaction 1 posting 2 reads "assets:bank:hdfc:savings | $12,000.00 | false"
    # …and the other grouped shape, a commodity with a space on the far side.
    And the ledger transaction 41 posting 1 reads "expenses:food:dining:restaurants | 1,240.00 INR | false"
    And there should be no page errors

  Scenario: A cost and a balance assertion are drawn as the file wrote them
    When I open the address "/money/personal.journal"
    # THE COST: `5 VTI @ $271.12` draws the amount the file stated and the
    # annotation beside it, which the reader keeps rather than converts with.
    And the ledger transaction 29 posting 1 reads "assets:investments:brokerage:VTI | 5 VTI | false"
    And the ledger transaction 29 posting 1 shows the cost "@ $271.12"
    # THE ASSERTION, on the quarter's last transaction: `$0 = $5,123.45` draws
    # both, and the assertion carries a title because it is a claim about a
    # running total this reader never kept.
    And the ledger transaction 47 posting 1 reads "assets:bank:hdfc:checking | $0 | false"
    And the ledger transaction 47 posting 1 shows the assertion "= $5,123.45"
    # …AND AN ASSERTION-ONLY POSTING IS NOT AN OMISSION TO FILL: the other
    # posting of that transaction is the inferred one.
    And the ledger transaction 47 posting 2 reads "equity:adjustments | | true"
    And the ledger transaction 47 posting 2 carries the inferred mark
    And there should be no page errors

  Scenario: Balances carry a column per commodity and the file's own digits
    When I open the address "/money/personal.journal"
    And I switch the ledger to the "balances" view
    And I set the ledger balance depth to "all"
    # THE COLUMNS: one per commodity the file uses, named by the band and keyed
    # by `data-commodity`.
    And the ledger balances head the commodities "$, EUR, INR, VTI"
    # A ROW'S CELLS are what the columns are for: two dollars down one
    # right-aligned tabular column, and the other commodities in theirs.
    And the ledger balance for "assets:bank:hdfc:checking" shows "$8,326.20" in "$"
    And the ledger balance for "assets:bank:hdfc:savings" shows "$10,756.73" in "$"
    And the ledger balance for "assets:bank:wise:eur" shows "813.80 EUR" in "EUR"
    And the ledger balance for "assets:cash:wallet" shows "1,260.00 INR" in "INR"
    And the ledger balance for "assets:investments:brokerage:VTI" shows "5 VTI" in "VTI"
    # AN ACCOUNT THE FILE NAMED AND NEVER MOVED draws the empty marker rather
    # than nothing.
    And the ledger balance for "equity:adjustments" has no total
    And there should be no page errors

  Scenario: The tree folds, unfolds, and the depth control hides what is under it
    When I open the address "/money/personal.journal"
    And I switch the ledger to the "balances" view
    And I set the ledger balance depth to "all"
    # THE WHOLE TREE first — every account the file named, parents expanded.
    And the ledger balances draw 48 rows
    # FOLD A PARENT: its children go, and its chevron says so.
    When I collapse the ledger balance for "assets:bank:hdfc"
    Then the ledger balance for "assets:bank:hdfc" is collapsed
    And the ledger balance for "assets:bank:hdfc:checking" is not drawn
    And the ledger balances draw 46 rows
    When I expand the ledger balance for "assets:bank:hdfc"
    Then the ledger balance for "assets:bank:hdfc" is expanded
    And the ledger balance for "assets:bank:hdfc:checking" is drawn
    And the ledger balances draw 48 rows
    # THE DEPTH CONTROL: level 3 keeps three levels, so a depth-3 account goes.
    When I set the ledger balance depth to "3"
    Then the ledger balance for "assets:bank:hdfc" is drawn
    And the ledger balance for "assets:bank:hdfc:checking" is not drawn
    # …and level 1 keeps only the top, so a depth-1 parent goes too.
    When I set the ledger balance depth to "1"
    Then the ledger balance for "assets" is drawn
    And the ledger balance for "assets:bank" is not drawn
    And the ledger balances draw 6 rows
    And there should be no page errors
