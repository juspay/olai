@corpus:good
Feature: A ledger file in the vault
  A served directory is somebody's folder, and what is in one is not only
  outlines and notes. There is also the book somebody keeps: a plain-text
  ledger written by hledger, ledger or a script, in a `.journal`, a `.hledger`
  or a `.ledger`.

  The three suffixes are ONE kind — `@olai/format`'s kinds table claims all
  three as `holds: "text"` — so the sidebar draws one ledger glyph for every one
  of them, the row keeps its suffix in its name (it is not a document, so no
  title is invented for it), and its page is VIEW ONLY. A ledger is read.

  Scenario: The three suffixes are one kind, each with the ledger glyph
    When I open the app
    And I expand the folder "money"
    Then the "hledger" rows listed are "money/broken.journal, money/empty.journal, money/household.journal, money/ledger.ledger, money/wallet.hledger"
    # The glyph is the KIND's, asked of every suffix so that a `.ledger` drawn
    # with some other kind's mark is a failure rather than a detail.
    And the "hledger" row "money/household.journal" wears its own glyph
    And the "hledger" row "money/wallet.hledger" wears its own glyph
    And the "hledger" row "money/ledger.ledger" wears its own glyph
    # A ledger is not a document, so the name a row draws is the file's own —
    # suffix and all, exactly what the tab would say.
    And the "hledger" row "money/household.journal" reads "household.journal"
    And the "hledger" row "money/wallet.hledger" reads "wallet.hledger"
    # …and the outlines beside them are untouched: a vault that gained a kind
    # did not lose the one `Daily/2026-08.olai` lives in.
    And the "outline-olai" rows listed are "Daily/2026-08.olai, garden.olai, house.olai"
    And there should be no page errors

  Scenario: The noun the kind answers to is what a missing ledger is called
    # The registry's `noun` for this kind is `ledger` (`../src/claim.ts`), and
    # the one place a reader meets it is the page for an address that names no
    # file. Asserted here rather than in a unit test because the sentence is
    # drawn by the body page the ledger borrows.
    When I open the address "/money/nowhere.journal"
    Then the empty page says "Page not found" over "There is no ledger named money/nowhere.journal."
    And there should be no page errors

  # The address alone opens each of the three suffixes — a RELOAD, not a route,
  # because a prefix-free address is a real URL somebody can paste. One outline
  # rather than three scenarios, so a suffix that stopped being claimed is one
  # row of a failure and not a missing test.
  Scenario Outline: The address alone opens each ledger suffix
    When I open the address "/<file>"
    Then the document open is "<file>"
    And the address is "/<file>"
    And the ledger is showing the "transactions" view
    And the ledger header counts <transactions> <txnoun> and <accounts> <acnoun>
    # ONE POSTING EACH, so the three fixtures' arithmetic is read and not only
    # their header: the dollars of the household, the euros of the wallet, the
    # bare number of the `.ledger`.
    And the ledger transaction 1 posting 1 reads "<posting>"
    And there should be no page errors

    Examples:
      | file                    | transactions | txnoun       | accounts | acnoun   | posting                                    |
      | money/household.journal | 5            | transactions | 12       | accounts | assets:bank:checking \| $1200.00 \| false  |
      | money/wallet.hledger    | 1            | transaction  | 4        | accounts | expenses:coffee \| 4.50 EUR \| false       |
      | money/ledger.ledger     | 1            | transaction  | 4        | accounts | expenses:transport \| 2.75 \| false        |

  # The sidebar's half of the same door: a reader who does not know the address
  # finds the row. A ROUTE, not a reload — the page answers in place, exactly as
  # a document's link does.
  Scenario: Clicking a ledger in the sidebar opens its page in place
    When I open the app
    And I expand the folder "money"
    Given I mark the page
    When I click the "hledger" row "money/household.journal"
    Then the document open is "money/household.journal"
    And the address is "/money/household.journal"
    And the page has not reloaded
    And the ledger is showing the "transactions" view
    And the ledger header counts 5 transactions and 12 accounts
    And there should be no page errors

  # A ledger is a file of the vault, so the palette finds it by name and opens
  # it — the row this kind earns in the same list `.md` does.
  Scenario: The palette finds a ledger by name and opens it
    When I open the app
    Given I mark the page
    When I press the palette shortcut
    And I type "household" into the palette
    Then the palette lists the document "money/household.journal"
    When I pick the palette item "household"
    Then the document open is "money/household.journal"
    And the address is "/money/household.journal"
    And the page has not reloaded
    And the ledger is showing the "transactions" view
    And there should be no page errors
