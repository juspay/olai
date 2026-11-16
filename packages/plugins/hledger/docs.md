# Reading hledger journal files

olai shows a `.journal`, `.hledger` or `.ledger` file, a plain-text accounting file, read-only in three views.[^claim] Nothing has to be installed, and hledger is never run.

## The three views

Above the views is a row of facts about the file: the days it covers, how many transactions and accounts it has, and the commodities, the currencies and units, it uses.[^warn] The three views are tabs: **Transactions**, **Balances** and **Source**.[^keys] Every journal opens on **Transactions**, every time, because olai does not remember which view you left a file on. What each view draws is in the closed block at the foot of this page.

## What olai does not work out for you

This is a reading of a journal, not an accounting engine. Anything a bookkeeping tool would compute is kept as the file wrote it, and the closed block below says what olai does with each such line.[^infer] The totals in **Balances** are the sums of the postings as written, and the amounts are exact.[^exact]

## How much of a file is read

olai reads a journal up to 20,000 lines and 1,000 transactions, and cuts any single field at 2,000 characters.[^fields] When one of these limits cut something short, a quiet line under the views says so.[^said] It does not say how much was left out.[^cut] A file with no transactions and no directives shows `No transactions yet` instead of three empty views.

## What an agent can do with it

No tool writes a journal. `files_delete` refuses to delete one,[^delete] and you cannot attach a journal to a conversation with an agent ([giving an agent work](../giving-an-agent-work.md)).

[^claim]: olai claims `.journal`, `.hledger` and `.ledger` files and reads them itself, in the syntax hledger and ledger share. Editing a journal stays with whatever program keeps your books.

[^warn]: When some lines could not be read, the row of facts ends in a button, `⚠ 3 lines not read`, which takes you to **Source** at the first of those lines.

[^keys]: `Left` and `Right` move between **Transactions**, **Balances** and **Source**, and `Home` and `End` jump to the first and the last of them.

[^infer]: olai works nothing out from a transaction that carries a cost, because hledger balances such a transaction in the cost's commodity, and this reading does not convert between commodities. A posting whose amount olai cannot read is kept as a line of text rather than guessed at, and is counted in the button of lines not read.

[^exact]: A quantity keeps the digits it was written with, and is never turned into a floating-point number.

[^fields]: A field is a description, a comment, an account, a tag or a source line.

[^said]: The line under the views is `Showing the first 1,000 transactions.` for the transaction limit, `The file is longer than 20,000 lines; only the beginning was read.` for the line limit, and `Long lines are cut at 2,000 characters.` for the field limit.

[^cut]: The reading stops at the limit, so nothing counted what came after it. An account name that was cut drops a trailing `:` rather than showing an empty segment, and two accounts that are identical once cut are drawn as one row. The tree and the postings above it always agree about how long an account name is.

[^delete]: `files_delete` answers `olai only shows files of this kind and never writes one`.

<details>
<summary>What each view draws</summary>

### Transactions

The file's own order, under a band naming the month each run of transactions belongs to. A file that goes back to an earlier month starts a new band rather than merging into the first one.

Each entry draws its day, its mark (a filled dot for cleared, a half dot for pending, a ring for unmarked), the payee, the note written after `|`, and the code in parentheses. A second date the file wrote follows the day, after an `=`. A comment is drawn as the prose it is, with its tags as pills beside it. Pointing at a day shows the whole date, which a screen reader also reads out.

Under the entry, each posting carries its account and the amount as the file wrote it, so `-$10` keeps its minus where it is and `$4,250.00` keeps its grouping. A cost (`@ $271.12`) or a balance assertion (`= $5,123.45`) is drawn beside the amount, as the annotation the file made it. A posting whose amount the file left out, and which olai worked out here so the group balances, is marked with a hollow circle, `◌`, whose tip reads `inferred`.

### Balances

Every account the file names, as a tree, with one column per commodity. A parent adds its children up, so `assets` shows the sum of everything under it. A commodity a row does not hold leaves its column blank, and a row with no total at all shows `—`: zero and nothing are different facts. A cell holds the number and its sign alone, since the column heading already names the commodity.

The tree opens two levels deep. The depth control clips it to `1`, `2`, `3` or **All**, and the chevron beside a parent opens or closes that one account. Opening a parent deeper than the control allows overrules the control for that account; changing the control drops those overrules. Accounts you closed yourself stay closed through both the control and a rewrite of the file, as long as the account is still in it.

A total is olai's own arithmetic rather than the file's spelling, so it is written one way. A symbol goes against the number with the minus in front (`-$1,200.00`), a word commodity goes after the number with a space, and the integer part is grouped in threes.

### Source

The file's own lines, as far as they were read, under a gutter numbering each one. Nothing here comes from olai's reading. A comment and a directive are muted, a line the reading could not place is marked in the alarm colour, and a line past the character limit is cut like any other field. A directive's indented lines belong to it and carry its mark.

</details>

<details>
<summary>What becomes of a cost, an assertion, a rule or a directive</summary>

| In the file | What olai does with it |
| --- | --- |
| a cost, `@` or `@@` | draws it beside the amount; the posting's own amount is what moved the account |
| a balance assertion, `=` after an amount | draws it beside the amount, and checks nothing |
| an automatic posting rule, `=` at the start of a line | keeps the directive, never applies it |
| a periodic transaction, `~` | keeps the directive, never applies it |
| `include` | does not follow it: the balances are the postings in this file |
| `alias`, `D`, `P`, `commodity`, `account` | keeps them in order, as text, never applies them |

</details>
