# hledger journals

olai claims `.journal`, `.hledger` and `.ledger` files and draws a journal
read-only, in three views. It reads the file itself, in the syntax hledger and
ledger share, so nothing has to be installed and hledger is never run. Editing
a journal stays with whatever keeps your books.

## The three views

Above the views is a row of facts about the file: the days it spans, how many
transactions and accounts it has, and the commodities it uses. When some lines
could not be read, the row ends in a button, `⚠ 3 lines not read`, which takes
you to **Source** at the first of them.

The strip of views is a tablist. `Left` and `Right` move between
**Transactions**, **Balances** and **Source**, and `Home` and `End` jump to the
ends. Every journal opens on **Transactions**, every time: which view you left
a file on is not remembered.

### Transactions

The file's own order, under a band naming the month each run of transactions
belongs to. A file that goes back to an earlier month starts a new band rather
than merging into the first one.

Each entry draws its day, its mark (a filled dot for cleared, a half dot for
pending, a ring for unmarked), the payee, the note written after `|`, and the
code in parentheses. A second date the file wrote follows the day, after an
`=`. A comment is drawn as the prose it is, with its tags as pills beside it.
Pointing at a day shows the whole date, which a screen reader also reads out.

Under the entry, each posting carries its account and the amount as the file
wrote it, so `-$10` keeps its minus where it is and `$4,250.00` keeps its
grouping. A cost (`@ $271.12`) or a balance assertion (`= $5,123.45`) is drawn
beside the amount, as the annotation the file made it. A posting whose amount
the file left out, worked out here to balance its group, is marked inferred
with a hollow circle, `◌`.

### Balances

Every account the file names, as a tree, with one column per commodity. A
parent rolls its children up, so `assets` shows the sum of everything under it.
A commodity a row does not hold leaves its column blank, and a row with no
total at all shows `—`: zero and nothing are different facts. A cell holds the
number and its sign alone, since the column heading already names the
commodity.

The tree opens two levels deep. The depth control clips it to `1`, `2`, `3` or
**All**, and the chevron beside a parent opens or closes that one account.
Opening a parent past the control's cut overrules the control for that account;
changing the control drops those overrules. Closes of your own survive both the
control and a rewrite of the file, as long as the account is still in it.

A total is olai's arithmetic rather than the file's spelling, so it is written
one way. A symbol goes against the number with the minus in front
(`-$1,200.00`), a word commodity goes after the number with a space, and the
integer part is grouped in threes.

### Source

The file's own lines, as far as they were read, under a gutter numbering each
one. Nothing here is drawn from the reading. A comment and a directive are
muted, a line the reading could not place is marked in alarm, and a line past
the character bound is cut like any other field. A directive's indented lines
belong to it and carry its mark.

## What it does not work out

This is a reading of a journal, not an accounting engine. What a bookkeeping
tool would compute is kept as the file wrote it:

| In the file | What olai does with it |
| --- | --- |
| a cost, `@` or `@@` | draws it beside the amount; the posting's own amount is what moved the account |
| a balance assertion, `=` after an amount | draws it beside the amount, and checks nothing |
| an automatic posting rule, `=` at the start of a line | keeps the directive, never applies it |
| a periodic transaction, `~` | keeps the directive, never applies it |
| `include` | does not follow it: the balances are the postings in this file |
| `alias`, `D`, `P`, `commodity`, `account` | keeps them in order, as text, never applies them |

A transaction carrying a cost is never inferred from, because hledger balances
such a transaction in the cost's commodity and this reading does not convert.
A posting whose amount olai cannot read is kept as a line of text rather than
guessed at, and counted in the button of lines not read.

The totals in **Balances** are the sums of the postings as written. Money is
exact: a quantity keeps the digits it was written with, and is never a
floating-point number.

## How much of a file is read

A journal is read up to 20,000 lines and 1,000 transactions, and no single
field (a description, a comment, an account, a tag or a source line) is longer
than 2,000 characters. When a bound cut something short, a quiet line under the
views says so:

| Bound | The line under the views |
| --- | --- |
| 1,000 transactions | `Showing the first 1,000 transactions.` |
| 20,000 lines | `The file is longer than 20,000 lines; only the beginning was read.` |
| 2,000 characters in one field | `Long lines are cut at 2,000 characters.` |

No count of what was left out is given: the reading stops at the bound, so
nothing counted the rest. A cut account drops a trailing `:` rather than
drawing an empty segment, and two accounts whose cut leaves them identical draw
as one row. The tree and the postings above it always agree about how long an
account is.

A file with no transactions and no directives draws the empty state, `No
transactions yet`, rather than three empty views.

## What an agent can do with it

No tool writes a journal. `files_delete` refuses one, saying `olai only shows
files of this kind and never writes one`, and a journal is not a kind you can
attach to a conversation
([giving an agent work](../giving-an-agent-work.md)).
