# Hledger

A journal is a plain-text book of account: transactions written as a date, a
description and the postings that moved money between accounts, in the syntax
hledger and ledger share. Olai claims the three usual suffixes — `.journal`,
`.hledger` and `.ledger` — and draws a journal read-only, in three views.

## The three views

The page opens on **Transactions**, the file's own order: each date, its status
and code, the description, then the postings under it with their accounts and
amounts. A posting whose amount was left out of the file and worked out to
balance the rest of its group — the ordinary postings, or the balanced virtual
ones, since an unbalanced `(…)` posting balances nothing — is marked
_inferred_, so you can tell the format's arithmetic from what was written.
Transaction comments and tags are shown quietly beside the entry that carries
them. Every amount is drawn as the file wrote it, so a minus written before a
symbol stays where it is (`-$10`); a posting whose amount cannot be read at all
is kept as raw text rather than guessed at, because a line this reader cannot
turn into an account and an amount is not one it invents a number for.

**Balances** is the same file read the other way: every account that was named,
as a tree. Parent accounts roll their children up, so `assets` shows the sum of
everything under it, and each row carries its own total per commodity. A total
is this app's arithmetic rather than anybody's spelling, so it is written in one
house style — a symbol against the number with the minus in front of it
(`-$1200.00`), a word commodity after the number with a space.

**Raw** is the file's own lines, as far as they were read: nothing on that view
is re-rendered from the parse, which is the point of it. The drawing stops
where the reading does (the line bound below), a line longer than the character
cut is shortened like any other field, and a line the reader kept as raw text
carries the kind it is — a directive, a comment, or a line it could not place.
A directive's indented sub-lines are that directive, and they carry its mark.

The view is per file. Opening another journal starts again on Transactions,
which is the reading a journal is opened for; nothing remembers which tab you
left a file on.

## View only

A journal is claimed as text, but olai never writes one. There is no editor and
no create verb; opening a journal shows you what is in it, and editing is what
your hledger file already belongs to. The reading is this plugin's own — the
modules under `src/journal/` — and it is deliberately narrower than hledger
itself, which is what the next section is about.

A link to a journal opens its page and draws no preview card. The card a link
shows under the pointer is contributed per kind, and only the kinds with one
have it — a document, an outline node, an agent session. A journal is not among
them, so a link to one behaves exactly as a link to a `.csv` does: it opens the
page, and nothing appears under the pointer.

## What is not modelled

This is a reading of a journal, not an accounting engine. Transaction costs and
prices, automated postings, and periodic or generated transactions are **not**
applied — a journal that depends on them will show the lines it was written
with rather than the lines hledger would produce from them. The totals in the
Balances view are the sums of the postings as written.

## Bounds

A journal is read up to 20,000 lines and 1,000 transactions, and no single
field — a description, a comment, an account, a tag or a raw line — is longer
than 2,000 characters; the page draws what fit. When something was left out —
because the file is longer than the line bound, held more transactions than the
transaction bound, or overran the character cut — a quiet line under the views
says so, for example `Showing the first 1,000 transactions.`, `The file is
longer than 20,000 lines; only the beginning was read.` or `Long lines are cut
at 2,000 characters.` An empty file says `This file is empty.` instead of
drawing three empty panels.
