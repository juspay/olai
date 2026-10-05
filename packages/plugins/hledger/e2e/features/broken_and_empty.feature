@scratch:good @share-scratch
Feature: A ledger that is broken, and one that is empty
  A journal is somebody's file, and the file on disk can be half-written: an
  editor died mid-line, a script emitted a date that names no day, a posting
  lost its account. What the reader must NOT do is take the page down with it —
  this row's reader is total, and a line it cannot make sense of is kept
  as a raw entry rather than thrown.

  So the malformed lines are visible in Source and in none of the transactions:
  a date-shaped header whose date names no real day is not a transaction at
  all, which is what `money/broken.journal` and the header's count together
  say — and the header now counts them, and a press on it lands on the first.

  And a file with nothing in it is a real thing to find out, so the page draws
  the app's empty block — the glyph and "No transactions yet" — rather than
  three empty views for the reader to work it out of.

  Background:
    Given the ledger fixtures are served

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
    # THE HEADER SAYS what the reader could not read — three lines — and its
    # button GOES there rather than leaving a reader to hunt the Source view.
    And the ledger header reports 3 lines not read
    When I click the ledger unreadable button
    Then the ledger is showing the "source" view
    # The first of them is the date-shaped line that names no day; the jump
    # scrolls it into view, and its own `data-entry="unknown"` is the mark.
    And the ledger source line 8 is kept as "unknown"
    And the ledger source line 8 is in view
    # THE OTHER HALF: the source view is the file's own lines, malformed ones
    # and all.
    And the ledger source view is the file "money/broken.journal"
    And there should be no page errors

  Scenario: An empty file draws the empty state rather than three empty views
    When I open the address "/money/empty.journal"
    Then the document open is "money/empty.journal"
    # THE EMPTY BLOCK, not tabs over a sentence the page no longer draws: the
    # header still says what it counted, and there is no view strip at all.
    And the ledger header counts 0 transactions and 0 accounts
    And the ledger shows the empty state "No transactions yet"
    And the ledger draws no tabs
    And there should be no page errors
