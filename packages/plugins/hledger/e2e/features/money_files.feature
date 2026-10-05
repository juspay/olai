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
