@scratch:good @share-scratch
Feature: A journal's odd lines, said rather than guessed at
  A journal is somebody's file, and the lines in it are not always the shape a
  reader expects: a comment sits under a transaction header, a minus is written
  on either side of a symbol, an amount cannot be read, a transaction states two
  commodities and omits a third amount, a description runs to thousands of
  characters, a file is longer than a page. this row's reader is total and
  bounded, and every one of those lines has a ruling: what it becomes, what it
  does NOT become, and what the page owes the reader about it.

  Each scenario writes its own file (`@scratch:good`), because a fixture whose
  whole point is one odd line is one odd line the repository should not hold —
  and the one that is longer than 20,000 lines could not be held at all.

  Background:
    Given the ledger fixtures are served

  Scenario: An indented comment belongs to the header above it, or the posting
    Given I rewrite "money/odd.journal" as:
      """
      2024-01-02 * Groceries
          ; the weekly shop trip:berlin
          expenses:groceries        $10.00
          assets:cash
          ; paid in coins
      """
    When I open the address "/money/odd.journal"
    Then the document open is "money/odd.journal"
    And the ledger transaction 1 carries the comment "the weekly shop"
    And the ledger transaction 1 carries the tags "#trip:berlin"
    And the ledger transaction 1 draws 2 postings
    And the ledger transaction 1 posting 2 carries the comment "paid in coins"
    And the ledger transaction 1 posting 1 reads "expenses:groceries | $10.00 | false"
    And the ledger transaction 1 posting 2 reads "assets:cash | -$10.00 | true"
    And the ledger header counts 1 transaction and 4 accounts
    And there should be no page errors

  Scenario: A negative symbol amount keeps whichever side the file put the minus
    Given I rewrite "money/odd.journal" as:
      """
      2024-01-02 * Two ways to write a negative
          one                       $-10
          two                       -$10
      """
    When I open the address "/money/odd.journal"
    And the ledger transaction 1 posting 1 reads "one | $-10 | false"
    And the ledger transaction 1 posting 2 reads "two | -$10 | false"
    And there should be no page errors

  Scenario: An omitted amount between two commodities is left un-inferred
    Given I rewrite "money/odd.journal" as:
      """
      2024-01-02 * Cross-commodity
          expenses:travel           100.00 EUR
          assets:bank:checking      $120.00
          expenses:fees
      """
    When I open the address "/money/odd.journal"
    And the ledger transaction 1 posting 3 reads "expenses:fees | | false"
    And there should be no page errors

  Scenario: A posting whose amount cannot be read is kept as the raw line it is
    Given I rewrite "money/odd.journal" as:
      """
      2024-01-02 * Unreadable amount
          a  1E3 X
      """
    When I open the address "/money/odd.journal"
    And the ledger transaction 1 draws 0 postings
    And the ledger header counts 1 transaction and 0 accounts
    And the ledger page says nothing
    When I switch the ledger to the "source" view
    And the ledger source line 2 reads "a 1E3 X"
    And the ledger source line 2 is kept as "unknown"
    And there should be no page errors

  Scenario: A file past the line bound says so and draws only what was read
    Given a ledger of 25000 lines exists at "money/long.journal"
    When I open the address "/money/long.journal"
    And the ledger page says "The file is longer than 20,000 lines; only the beginning was read."
    When I switch the ledger to the "source" view
    And the ledger source view draws 20000 lines
    And there should be no page errors

  Scenario: A field past the cell bound is said to be cut
    Given a ledger whose description is 2500 characters exists at "money/cut.journal"
    When I open the address "/money/cut.journal"
    And the ledger page says "Long lines are cut at 2,000 characters."
    And the ledger transaction 1 description is 2000 characters long
    And there should be no page errors

  Scenario: Opening another ledger resets the view to Transactions
    When I open the address "/money/household.journal"
    And I switch the ledger to the "source" view
    Then the ledger is showing the "source" view
    When I expand the folder "money"
    Given I mark the page
    When I click the ledger row "money/wallet.hledger"
    Then the document open is "money/wallet.hledger"
    And the address is "/money/wallet.hledger"
    And the page has not reloaded
    And the ledger is showing the "transactions" view
    And there should be no page errors

  Scenario: The tab strip's arrow keys move the selection and the focus
    When I open the address "/money/household.journal"
    And I focus the ledger tab "transactions"
    When I press "ArrowRight"
    Then the ledger is showing the "balances" view
    And the ledger tab "balances" has focus
    When I press "ArrowLeft"
    Then the ledger is showing the "transactions" view
    And the ledger tab "transactions" has focus
    When I press "End"
    Then the ledger is showing the "source" view
    And the ledger tab "source" has focus
    When I press "Home"
    Then the ledger is showing the "transactions" view
    And the ledger tab "transactions" has focus
    When I press "ArrowLeft"
    Then the ledger is showing the "source" view
    And the ledger tab "source" has focus
    When I press "ArrowRight"
    Then the ledger is showing the "transactions" view
    And the ledger tab "transactions" has focus
    And there should be no page errors
