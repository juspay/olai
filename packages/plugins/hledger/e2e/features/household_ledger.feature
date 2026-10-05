@corpus:good
Feature: The page of a ledger whose arithmetic can be checked by hand
  `money/household.journal` is five transactions and twelve accounts, in round
  amounts, in dollars and euros. It is built so that every number a scenario
  asserts is one a person can add up: one cleared transaction, one pending, a
  code, a `payee | note` description, a trailing comment with tags, an omitted
  posting the reader infers, a two-space account whose name holds a single
  space, a virtual posting, a cost annotation the reader does not model, a
  second commodity, and a section of directives and comments for the raw view.

  The three views are one page: Transactions is what a journal is opened to
  read, Balances is the tree the postings net to, and Raw is the bytes the page
  actually read.

  Scenario: The transactions view reads out the header's facts and the postings
    When I open the address "/money/household.journal"
    Then the document open is "money/household.journal"
    And the address is "/money/household.journal"
    # A ledger has no editor — `markdown_write` takes a `.md` and refuses
    # anything else, so an Edit control here would be a door onto a refusal.
    And this file has no editor
    # The strip opens on Transactions, and the header counts what the file
    # holds: 5 transactions, and every account a posting named plus every
    # parent prefix (assets, assets:bank, assets:bank:checking,
    # assets:bank:savings, budget, budget:travel, equity,
    # equity:opening balances, expenses, expenses:dining out,
    # expenses:groceries, expenses:travel).
    And the ledger is showing the "transactions" view
    And the ledger header counts 5 transactions and 12 accounts
    And the ledger header spans "2024-01-02–2024-03-01"
    And the ledger draws 5 transactions
    # A cleared transaction with no code and a one-line description.
    And the ledger transaction 1 is dated "2024-01-02"
    And the ledger transaction 1 has status "cleared"
    And the ledger transaction 1 carries code ""
    And the ledger transaction 1 is described "Opening balance"
    And the ledger transaction 1 posting 1 reads "assets:bank:checking | $1200.00 | false"
    # An account whose NAME holds a single space — the account ends at the two
    # spaces before the amount, which is the whole of what that rule is for.
    And the ledger transaction 1 posting 2 reads "equity:opening balances | $-1200.00 | false"
    And the ledger transaction 5 posting 1 reads "expenses:dining out | $60.00 | false"
    # The `payee | note` description as the file wrote it, the code in
    # parentheses, the comment whole and the tags again as their own spans.
    And the ledger transaction 2 is dated "2024-01-03"
    And the ledger transaction 2 has status "cleared"
    And the ledger transaction 2 carries code "groceries"
    And the ledger transaction 2 is described "Supermarket | weekly shop"
    And the ledger transaction 2 carries the comment "groceries run trip:berlin paid:card"
    And the ledger transaction 2 carries the tags "trip: berlin, paid: card"
    And the ledger transaction 2 posting 1 reads "expenses:groceries | $120.50 | false"
    # THE INFERENCE, said rather than drawn as if the file had written it: one
    # posting omitted its amount and the transaction states one commodity, so
    # the reader filled in the balancing amount and marked it inferred.
    And the ledger transaction 2 posting 2 reads "assets:bank:checking | $-120.50 | true"
    # A pending transaction, the second commodity, and a cost annotation the
    # reader does NOT model: the amount is what the file states, `100.00 EUR`.
    And the ledger transaction 3 is dated "2024-02-14"
    And the ledger transaction 3 has status "pending"
    And the ledger transaction 3 carries code "trip"
    And the ledger transaction 3 posting 1 reads "expenses:travel | 100.00 EUR | false"
    # The virtual posting names its own account (the brackets are the kind, not
    # the name), and this one moves the budget the trip is drawn against.
    And the ledger transaction 4 posting 3 reads "budget:travel | -40.00 EUR | false"
    And there should be no page errors

  Scenario: Balances are the leaf totals and the parents they roll up to
    When I open the address "/money/household.journal"
    And I switch the ledger to the "balances" view
    Then the ledger is showing the "balances" view
    # THE LEAVES. Checking: +1200.00 − 120.50 (inferred) − 60.00 = 1019.50.
    And the ledger balance for "assets:bank:checking" is "$1019.50"
    And the ledger balance for "assets:bank:checking" is held in "$"
    # The depth is the account's own colons, which is what the flat tree's
    # indentation and its `data-depth` both say.
    And the ledger balance for "assets:bank:checking" sits at depth 2
    And the ledger balance for "equity:opening balances" is "$-1200.00"
    And the ledger balance for "expenses:groceries" is "$120.50"
    And the ledger balance for "expenses:dining out" is "$60.00"
    # The second commodity, at its own leaf: 100.00 + 40.00 = 140.00 EUR.
    And the ledger balance for "expenses:travel" is "140.00 EUR"
    # …and the virtual posting's account, which the reader sums like any other.
    And the ledger balance for "budget:travel" is "-40.00 EUR"
    # THE ROLL-UPS, per commodity and sorted by commodity: expenses holds
    # 120.50 + 60.00 dollars and 140.00 euros; assets:bank holds checking's
    # dollars and savings' −140.00 euros.
    And the ledger balance for "expenses" is "$180.50, 140.00 EUR"
    And the ledger balance for "assets:bank" is "$1019.50, -140.00 EUR"
    And the ledger balance for "assets" is "$1019.50, -140.00 EUR"
    And the ledger balance for "assets" is held in "$, EUR"
    And the ledger balance for "equity" is "$-1200.00"
    And there should be no page errors

  @scratch:good
  Scenario: The raw view is the file's own bytes
    When I open the address "/money/household.journal"
    And I switch the ledger to the "raw" view
    Then the ledger is showing the "raw" view
    # Every directive, every comment and every transaction header — the file
    # compared against the copy the server is serving, byte for byte. A view
    # that re-rendered the parse would fail here the first time the two
    # disagreed.
    And the ledger raw view is the file "money/household.journal"
    And there should be no page errors

  Scenario: The whole file is drawn, so the page says nothing about omissions
    When I open the address "/money/household.journal"
    Then the ledger page says nothing
    And there should be no page errors

  Scenario: A note that links the ledger is what points at it
    When I open the address "/money/household.journal"
    # One thing points here, and it is `money/notes.md` — the count first, then
    # the row by the file it opens.
    Then the document is pointed at by 1 thing(s)
    When I open what points at the document
    Then the referrers name "money/notes.md"
    And there should be no page errors

  Scenario: A note's link opens the ledger page
    # The other direction of the same link: the note beside the ledger is an
    # ordinary document whose relative `[household.journal](household.journal)`
    # opens the ledger's page in place.
    When I open the address "/money/notes.md"
    Then the document open is "money/notes.md"
    When I follow the link "household.journal" in the rendered markdown
    Then the document open is "money/household.journal"
    And the address is "/money/household.journal"
    # A route, not a reload: answered in place, exactly as the sidebar's click.
    And the page has not reloaded
    And the ledger is showing the "transactions" view
    And the ledger draws 5 transactions
    And there should be no page errors
