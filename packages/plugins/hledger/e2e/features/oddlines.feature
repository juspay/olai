@share-scratch
Feature: A journal's odd lines, said rather than guessed at
  A journal is somebody's file, and the lines in it are not always the shape a
  reader expects: a comment sits under a transaction header, a minus is written
  on either side of a symbol, an amount cannot be read, a transaction states two
  commodities and omits a third amount, a description runs to thousands of
  characters, a file is longer than a page. `@olai/format`'s reader is total and
  bounded, and every one of those lines has a ruling: what it becomes, what it
  does NOT become, and what the page owes the reader about it.

  Each scenario writes its own file (`@scratch:good`), because a fixture whose
  whole point is one odd line is one odd line the repository should not hold —
  and the one that is longer than 20,000 lines could not be held at all.

  @scratch:good
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
    # UNDER THE HEADER, before any posting, is the TRANSACTION's comment and
    # tags — and the value runs to the end of the comment, hledger's rule.
    And the ledger transaction 1 carries the comment "the weekly shop trip:berlin"
    And the ledger transaction 1 carries the tags "trip: berlin"
    # UNDER A POSTING is THAT posting's comment, and the line is not a posting
    # of its own: the transaction still draws exactly two, and the omitted
    # amount is still inferred.
    And the ledger transaction 1 draws 2 postings
    And the ledger transaction 1 posting 2 carries the comment "paid in coins"
    And the ledger transaction 1 posting 1 reads "expenses:groceries | $10.00 | false"
    And the ledger transaction 1 posting 2 reads "assets:cash | -$10.00 | true"
    # …so the account count is the two postings and their parents, nothing more.
    And the ledger header counts 1 transaction and 4 accounts
    And there should be no page errors

  @scratch:good
  Scenario: A negative symbol amount keeps whichever side the file put the minus
    Given I rewrite "money/odd.journal" as:
      """
      2024-01-02 * Two ways to write a negative
          one                       $-10
          two                       -$10
      """
    When I open the address "/money/odd.journal"
    # The file's own spelling is kept: `$-10` stays `$-10` and `-$10` stays
    # `-$10`. Only a COMPUTED amount is written by the format.
    And the ledger transaction 1 posting 1 reads "one | $-10 | false"
    And the ledger transaction 1 posting 2 reads "two | -$10 | false"
    And there should be no page errors

  @scratch:good
  Scenario: An omitted amount between two commodities is left un-inferred
    Given I rewrite "money/odd.journal" as:
      """
      2024-01-02 * Cross-commodity
          expenses:travel           100.00 EUR
          assets:bank:checking      $120.00
          expenses:fees
      """
    When I open the address "/money/odd.journal"
    # TWO COMMODITIES and one omission: no single amount balances the
    # transaction, so the posting says it could not be filled rather than
    # guessing one — the empty amount and the false are the refusal.
    And the ledger transaction 1 posting 3 reads "expenses:fees | | false"
    And there should be no page errors

  @scratch:good
  Scenario: A posting whose amount cannot be read is kept as the raw line it is
    Given I rewrite "money/odd.journal" as:
      """
      2024-01-02 * Unreadable amount
          a  1E3 X
      """
    When I open the address "/money/odd.journal"
    # The line LOOKS like a posting and states something the reader cannot make
    # sense of, so it is not guessed at: it is not a posting, and no account is
    # invented from it.
    And the ledger transaction 1 draws 0 postings
    And the ledger header counts 1 transaction and 0 accounts
    # …and nothing new is said about it — a line kept as text is ordinary.
    And the ledger page says nothing
    # THE OTHER HALF: the raw view is the file, so the line is still there, at
    # its own line number, marked as the unknown line it is.
    When I switch the ledger to the "raw" view
    And the ledger raw line 2 reads "a 1E3 X"
    And the ledger raw line 2 is kept as "unknown"
    And there should be no page errors

  @scratch:good
  Scenario: A file past the line bound says so and draws only what was read
    Given a ledger of 25000 lines exists at "money/long.journal"
    When I open the address "/money/long.journal"
    # THE CLAMP, SAID — the line bound is the one that ran out, and a file of
    # comments has no transaction header past its own bound to say anything else.
    And the ledger page says "The file is longer than 20,000 lines; only the beginning was read."
    # …AND THE DRAWING STOPS WHERE THE READING DID: one span per read line, a
    # page's worth, not the twenty-five thousand in the file.
    When I switch the ledger to the "raw" view
    And the ledger raw view draws 20000 lines
    And there should be no page errors

  @scratch:good
  Scenario: A field past the cell bound is said to be cut
    Given a ledger whose description is 2500 characters exists at "money/cut.journal"
    When I open the address "/money/cut.journal"
    # A description was READ and shortened, which is a different fact from the
    # reading stopping — so it is its own sentence.
    And the ledger page says "Long lines are cut at 2,000 characters."
    And there should be no page errors

  @scratch:good
  Scenario: Opening another ledger resets the view to Transactions
    When I open the address "/money/household.journal"
    And I switch the ledger to the "raw" view
    Then the ledger is showing the "raw" view
    # A journal is opened to read, so the page's default is Transactions and a
    # view is the page's own state — the next file starts there again.
    When I open the address "/money/wallet.hledger"
    Then the document open is "money/wallet.hledger"
    And the ledger is showing the "transactions" view
    And there should be no page errors

  @scratch:good
  Scenario: The tab strip's arrow keys move the selection and the focus
    When I open the address "/money/household.journal"
    And I focus the ledger tab "transactions"
    # Right and Left wrap through the three views, and the moved-to tab takes
    # the focus — the roving tabindex of a real tabs pattern.
    When I press "ArrowRight"
    Then the ledger is showing the "balances" view
    And the ledger tab "balances" has focus
    When I press "ArrowLeft"
    Then the ledger is showing the "transactions" view
    And the ledger tab "transactions" has focus
    # Home and End jump to the ends rather than stepping.
    When I press "End"
    Then the ledger is showing the "raw" view
    And the ledger tab "raw" has focus
    When I press "Home"
    Then the ledger is showing the "transactions" view
    And the ledger tab "transactions" has focus
    And there should be no page errors
