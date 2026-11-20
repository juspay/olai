@scratch:good @share-scratch
Feature: A ledger file that moves, and one bigger than a page
  A served directory is live: a file rewritten under an open page redraws it,
  and one that is deleted is a page that is no longer there. Both are what the
  watcher is for, and both are read here through the page a reader already has
  open.

  The size bound is the same kind of claim one file over. this row's reader
  stops at a thousand transactions rather than reading a data dump, and the
  page must SAY what it left out — a table of the first thousand rows of
  twelve hundred with nothing saying so is a lie the reader cannot see. The
  file is written by the scenario (a fixture whose whole point is being big is
  thousands of lines of nothing in the repository) and kept with a private copy,
  like the csv clamp's.

  Background:
    Given the ledger fixtures are served

  @own-scratch
  Scenario: A journal past the transaction bound says what it left out
    Given a journal of 1200 transactions exists at "money/big.journal"
    When I open the address "/money/big.journal"
    Then the document open is "money/big.journal"
    And the ledger header counts 1000 transactions and 5 accounts
    And the ledger draws 1000 transactions
    And the ledger page says "Showing the first 1,000 transactions."
    And there should be no page errors

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
    And the ledger header counts 1 transaction and 5 accounts
    And there should be no page errors

  Scenario: Rewriting the ledger while Balances is showing recomputes it in place
    When I open the address "/money/household.journal"
    And I switch the ledger to the "balances" view
    And I set the ledger balance depth to "all"
    Then the ledger balance for "expenses:groceries" is "120.50"
    When I remember the ledger balances
    And I rewrite "money/household.journal" as:
      """
      ; rewritten while the balances tree is showing
      2024-01-02 * Opening balance
          assets:bank:checking      $1200.00
          equity:opening balances  -$1200.00

      2024-01-03 * Groceries
          expenses:groceries        $50.00
          assets:bank:checking      -$50.00
      """
    Then the ledger header counts 2 transactions and 7 accounts
    And the ledger is showing the "balances" view
    And the ledger balances stayed mounted during its revision
    And the ledger balance for "expenses:groceries" is "50.00"
    And the ledger balance for "assets:bank:checking" is "1,150.00"
    And there should be no page errors

  Scenario: Rewriting the ledger under Balances moves a row's depth
    Given I rewrite "money/odd.journal" as:
      """
      2024-01-02 * Food
          expenses:food        $10.00
          assets:cash         -$10.00
      """
    When I open the address "/money/odd.journal"
    And I switch the ledger to the "balances" view
    And I set the ledger balance depth to "all"
    Then the ledger balance for "expenses:food" sits at depth 1
    When I rewrite "money/odd.journal" as:
      """
      2024-01-02 * Food
          expenses:food:snacks   $10.00
          assets                -$10.00
      """
    Then the ledger balance for "expenses:food:snacks" sits at depth 2
    And there should be no page errors

  Scenario: Rewriting the ledger under Transactions moves a tag's value
    Given I rewrite "money/odd.journal" as:
      """
      2024-01-02 * Groceries  ; trip:berlin, paid:card
          expenses:food        $10.00
          assets:cash         -$10.00
      """
    When I open the address "/money/odd.journal"
    Then the ledger transaction 1 carries the tags "#trip:berlin, #paid:card"
    When I rewrite "money/odd.journal" as:
      """
      2024-01-02 * Groceries  ; trip:munich, paid:card
          expenses:food        $10.00
          assets:cash         -$10.00

      2024-01-03 * Coffee
          expenses:coffee       $3.00
          assets:cash          -$3.00
      """
    Then the ledger draws 2 transactions
    And the ledger transaction 1 carries the tags "#trip:munich, #paid:card"
    And there should be no page errors

  Scenario: A collapsed branch stays collapsed across a live rewrite
    When I open the address "/money/household.journal"
    And I switch the ledger to the "balances" view
    And I set the ledger balance depth to "all"
    And the ledger balance for "assets:bank" is expanded
    When I collapse the ledger balance for "assets:bank"
    Then the ledger balance for "assets:bank" is collapsed
    And the ledger balance for "assets:bank:checking" is not drawn
    When I rewrite "money/household.journal" as:
      """
      2024-01-02 * Opening balance
          assets:bank:checking      $1300.00
          equity:opening balances  -$1300.00

      2024-01-03 * Groceries
          expenses:groceries        $10.00
          assets:bank:checking      -$10.00
      """
    Then the ledger header counts 2 transactions and 7 accounts
    And the ledger balance for "assets:bank" is collapsed
    And the ledger balance for "assets:bank:checking" is not drawn
    When I expand the ledger balance for "assets:bank"
    Then the ledger balance for "assets:bank:checking" is "1,290.00"
    And there should be no page errors

  Scenario: A removed ledger that comes back draws its page again
    When I open the address "/money/household.journal"
    Given I mark the page
    Then the ledger is showing the "transactions" view
    When I remove the served file "money/household.journal"
    Then the empty page says "Page not found" over "There is no ledger named money/household.journal."
    When I rewrite "money/household.journal" as:
      """
      2024-01-02 * Opening balance
          assets:bank:checking      $1200.00
          equity:opening balances  -$1200.00
      """
    Then the document open is "money/household.journal"
    And the ledger header counts 1 transaction and 5 accounts
    And the ledger transaction 1 is described "Opening balance"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Deleting the ledger under an open page is handled
    When I open the address "/money/household.journal"
    Then the ledger is showing the "transactions" view
    When I remove the served file "money/household.journal"
    Then the empty page says "Page not found" over "There is no ledger named money/household.journal."
    And the address is "/money/household.journal"
    And there should be no page errors

  @scratch:good @own-scratch
  Scenario: A ledger that was on disk before the server booted is served
    When the server stops
    And the server starts again on the same port
    When I open the address "/money/household.journal"
    Then the document open is "money/household.journal"
    And the ledger header counts 5 transactions and 12 accounts
    And the ledger draws 5 transactions
    And the ledger transaction 2 posting 2 reads "assets:bank:checking | -$120.50 | true"
    When I switch the ledger to the "balances" view
    And I set the ledger balance depth to "all"
    Then the ledger balance for "assets:bank:checking" is "1,019.50"
    And the ledger balance for "expenses" is "180.50, 140.00"
    And there should be no page errors
