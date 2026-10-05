@share-scratch
Feature: A ledger file that moves, and one bigger than a page
  A served directory is live: a file rewritten under an open page redraws it,
  and one that is deleted is a page that is no longer there. Both are what the
  watcher is for, and both are read here through the page a reader already has
  open.

  The size bound is the same kind of claim one file over. `@olai/format`'s
  reader stops at a thousand transactions rather than reading a data dump, and
  the page must SAY what it left out — a table of the first thousand rows of
  twelve hundred with nothing saying so is a lie the reader cannot see. The
  file is written by the scenario (a fixture whose whole point is being big is
  thousands of lines of nothing in the repository) and kept with a private copy,
  like the csv clamp's.

  @scratch:good @own-scratch
  Scenario: A journal past the transaction bound says what it left out
    Given a journal of 1200 transactions exists at "money/big.journal"
    When I open the address "/money/big.journal"
    Then the document open is "money/big.journal"
    # The reading stopped, so the header counts what was KEPT, not what is in
    # the file — and the accounts are the two the generated postings name plus
    # their prefixes.
    And the ledger header counts 1000 transactions and 5 accounts
    And the ledger draws 1000 transactions
    # THE CLAMP, SAID — the sentence names the bound and no total, because a
    # total is a number only a full scan knows and the scan is what stopped.
    And the ledger page says "Showing the first 1,000 transactions."
    And there should be no page errors

  @scratch:good
  Scenario: Rewriting the ledger under an open page redraws it
    When I open the address "/money/household.journal"
    Then the ledger header counts 5 transactions and 12 accounts
    And the ledger transaction 1 is described "Opening balance"
    When I rewrite "money/household.journal" as:
      """
      ; rewritten under the reader
      2024-01-02 * Opening balance | rewritten
          assets:bank:checking      $1200.00
          equity:opening balances  -$1200.00
      """
    Then the ledger draws 1 transactions
    And the ledger transaction 1 is described "Opening balance | rewritten"
    And the ledger header counts 1 transactions and 5 accounts
    And there should be no page errors

  @scratch:good
  Scenario: Deleting the ledger under an open page is handled
    When I open the address "/money/household.journal"
    Then the ledger is showing the "transactions" view
    When I remove the served file "money/household.journal"
    # The address still names the file; the file is gone, so the page is the
    # one every missing address gets — the same page, and the same noun.
    Then the empty page says "Page not found" over "There is no ledger named money/household.journal."
    And the address is "/money/household.journal"
    And there should be no page errors
