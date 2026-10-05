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
    # …AND A ROW DRAWS THE DAY, not the ISO string: the band above it names the
    # month, so `Jul 01` is the whole date a reader needs, and the ISO form is
    # still the cell's `title`.
    And the ledger transaction 1 draws the date "Jul 01"
    # THE AMOUNTS ARE ONE COLUMN DOWN THE PAGE, which is what makes a column of
    # money readable: every number's last digit in one place, and every suffix
    # commodity starting from one — `$4,250.00` and `850.00 EUR` do not end at
    # the same right edge, which is the whole reason the suffix has a column of
    # its own.
    And the ledger amounts line up on their last digit
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
    # posting of that transaction is the inferred one — and what it is inferred
    # AS is this reader's arithmetic, so it is written in the house style: the
    # stated posting claimed `$0`, so the balancing amount is `$0`.
    And the ledger transaction 47 posting 2 reads "equity:adjustments | $0 | true"
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
    # right-aligned tabular column, and the other commodities in theirs. A cell
    # is the number and its sign ALONE — the header names the commodity, so
    # `813.80` under `EUR` and `19,031.05` under `$`, and never `813.80 EUR`.
    And the ledger balance for "assets:bank:hdfc:checking" shows "8,326.20" in "$"
    And the ledger balance for "assets:bank:hdfc:savings" shows "10,756.73" in "$"
    And the ledger balance for "assets:bank:wise:eur" shows "813.80" in "EUR"
    And the ledger balance for "assets:cash:wallet" shows "1,260.00" in "INR"
    And the ledger balance for "assets:investments:brokerage:VTI" shows "5" in "VTI"
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

  Scenario: The chevron tells the truth at the depth control's cut, and overrules it
    When I open the address "/money/personal.journal"
    And I switch the ledger to the "balances" view
    # DEPTH 2 IS THE DEFAULT, and `assets:bank` sits AT the cut: its children
    # are hidden, so its chevron must say so — a `▾` on a row whose children are
    # not on screen is a control lying about its state.
    Then the ledger balance for "assets" is expanded
    And the ledger balance for "assets:bank" is collapsed
    And the ledger balance for "assets:bank:hdfc" is not drawn
    # …AND A PRESS OPENS IT PAST THE CUT: the reader overruling the control for
    # that one node rather than a second way to collapse it.
    When I expand the ledger balance for "assets:bank"
    Then the ledger balance for "assets:bank" is expanded
    And the ledger balance for "assets:bank:hdfc" is drawn
    # The children it just revealed are at the cut themselves, so the tree
    # still stops where the control said.
    And the ledger balance for "assets:bank:hdfc:checking" is not drawn
    When I collapse the ledger balance for "assets:bank"
    Then the ledger balance for "assets:bank:hdfc" is not drawn
    And there should be no page errors

  @phone
  Scenario: A phone draws the day on the payee's line and sets transactions apart
    When I open the address "/money/personal.journal"
    # THE DAY RIDES THE PAYEE LINE, left of the status mark, and the date
    # column is not drawn at all: there is no room for a column of dates, and
    # the band above already names the month.
    Then the ledger transaction 1 opens with the day "01"
    And the ledger transaction 2 opens with the day "01"
    # THE TRANSACTIONS ARE SET APART, so the row above does not read as part of
    # the one below — the phone has no date column to open one with.
    And the ledger transactions are set apart
    # …AND THE FACTS WRAP AS WHOLE ITEMS: `Jul 1 – Sep 30, 2026 · 47
    # transactions` then `· 48 accounts · $ EUR INR VTI`, never a fact split in
    # half and never a separator stranded at the end of a line.
    And the ledger header facts each stay on one line
    And there should be no page errors
