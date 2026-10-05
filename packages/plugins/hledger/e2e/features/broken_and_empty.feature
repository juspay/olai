@corpus:good
Feature: A ledger that is broken, and one that is empty
  A journal is somebody's file, and the file on disk can be half-written: an
  editor died mid-line, a script emitted a date that names no day, a posting
  lost its account. What the reader must NOT do is take the page down with it —
  `@olai/format`'s reader is total, and a line it cannot make sense of is kept
  as a raw entry rather than thrown.

  So the malformed lines are visible in Raw and in none of the transactions: a
  date-shaped header whose date names no real day is not a transaction at all,
  which is what `money/broken.journal` and the header's count together say.

  And a file with nothing in it is a real thing to find out, so the page says
  so rather than drawing three empty views for the reader to work it out of.

  Scenario: A half-written journal is still read as far as it goes
    When I open the address "/money/broken.journal"
    Then the document open is "money/broken.journal"
    # Two WHOLE transactions, and the accounts only those two named: the
    # `2024-6-32` line and the indented line under it are raw entries, so the
    # broken posting they look like is in no account tree.
    And the ledger header counts 2 transactions and 6 accounts
    And the ledger draws 2 transactions
    And the ledger transaction 2 is dated "2024-06-02"
    And the ledger transaction 2 is described "Groceries | mid-week"
    And the ledger transaction 2 posting 2 reads "assets:bank:checking | -31.25 | true"
    # THE OTHER HALF: the lines the reader could not read are still the file's,
    # so the raw view is the bytes of the file, malformed lines and all.
    When I switch the ledger to the "raw" view
    Then the ledger is showing the "raw" view
    And the ledger raw view is the file "money/broken.journal"
    And there should be no page errors

  Scenario: An empty file says it is empty rather than drawing nothing
    When I open the address "/money/empty.journal"
    Then the document open is "money/empty.journal"
    And the ledger header counts 0 transactions and 0 accounts
    And the ledger page says "This file is empty."
    And there should be no page errors
