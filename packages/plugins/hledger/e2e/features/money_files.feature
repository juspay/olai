@scratch:good @share-scratch
Feature: A ledger file in the vault
  A served directory is somebody's folder, and what is in one is not only
  outlines and notes. There is also the book somebody keeps: a plain-text
  ledger written by hledger, ledger or a script, in a `.journal`, a `.hledger`
  or a `.ledger`.

  The three suffixes are ONE kind — the registry's kinds table claims all
  three as `holds: "text"` — so the sidebar draws one ledger glyph for every one
  of them, the row keeps its suffix in its name (it is not a document, so no
  title is invented for it), and its page is VIEW ONLY. A ledger is read.

  The fixtures are this row's own (`e2e/fixtures/`), put into the served copy
  by the `Background` below rather than living in the harness's corpus: the
  harness knows no ledger kind, so the files a ledger scenario reads are the
  ledger's to serve.

  Background:
    Given the ledger fixtures are served

  Scenario: The three suffixes are one kind, each with the ledger glyph
    When I open the app
    And I expand the folder "money"
    Then the ledger rows listed are "money/broken.journal, money/empty.journal, money/household.journal, money/ledger.ledger, money/personal.journal, money/wallet.hledger"
    And the ledger row "money/household.journal" wears its own glyph
    And the ledger row "money/wallet.hledger" wears its own glyph
    And the ledger row "money/ledger.ledger" wears its own glyph
    And the ledger row "money/household.journal" reads "household.journal"
    And the ledger row "money/wallet.hledger" reads "wallet.hledger"
    And the "outline-olai" rows listed are "Daily/2026-08.olai, garden.olai, house.olai"
    And there should be no page errors

  Scenario: The noun the kind answers to is what a missing ledger is called
    When I open the address "/money/nowhere.journal"
    Then the empty page says "Page not found" over "There is no ledger named money/nowhere.journal."
    And there should be no page errors

  Scenario Outline: The address alone opens each ledger suffix
    When I open the address "/<file>"
    Then the document open is "<file>"
    And the address is "/<file>"
    And the ledger is showing the "transactions" view
    And the ledger header counts <transactions> <txnoun> and <accounts> <acnoun>
    And the ledger transaction 1 posting 1 reads "<posting>"
    And there should be no page errors

    Examples:
      | file                    | transactions | txnoun       | accounts | acnoun   | posting                                    |
      | money/household.journal | 5            | transactions | 12       | accounts | assets:bank:checking \| $1200.00 \| false  |
      | money/wallet.hledger    | 1            | transaction  | 4        | accounts | expenses:coffee \| 4.50 EUR \| false       |
      | money/ledger.ledger     | 1            | transaction  | 4        | accounts | expenses:transport \| 2.75 \| false        |

  Scenario: Clicking a ledger in the sidebar opens its page in place
    When I open the app
    And I expand the folder "money"
    Given I mark the page
    When I click the ledger row "money/household.journal"
    Then the document open is "money/household.journal"
    And the address is "/money/household.journal"
    And the page has not reloaded
    And the ledger is showing the "transactions" view
    And the ledger header counts 5 transactions and 12 accounts
    And there should be no page errors

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
