# Hledger

A journal is a plain-text book of account: transactions written as a date, a
description and the postings that moved money between accounts, in the syntax
hledger and ledger share. Olai claims the three usual suffixes — `.journal`,
`.hledger` and `.ledger` — and draws a journal read-only, in three views.

## The three views

The page opens on **Transactions**, the file's own order: each date, its status
and code, the description, then the postings under it with their accounts and
amounts. A posting whose amount was left out of the file and worked out from
the rest of the transaction is marked _inferred_, so you can tell the format's
arithmetic from what was written. Transaction comments and tags are shown
quietly beside the entry that carries them.

**Balances** is the same file read the other way: every account that was named,
as a tree. Parent accounts roll their children up, so `assets` shows the sum of
everything under it, and each row carries its own total per commodity.

**Raw** is the file itself, exactly as it is on disk. Nothing on that view has
been read or interpreted, which is the point of it.

## View only

A journal is claimed as text, but olai never writes one. There is no editor and
no create verb; opening a journal shows you what is in it, and editing is what
your hledger file already belongs to. The parsing rules are
[the format's](../format.md).

## What is not modelled

This is a reading of a journal, not an accounting engine. Transaction costs and
prices, automated postings, and periodic or generated transactions are **not**
applied — a journal that depends on them will show the lines it was written
with rather than the lines hledger would produce from them. The totals in the
Balances view are the sums of the postings as written.

## Bounds

A journal is read up to 20,000 lines and 1,000 transactions, and the page draws
what fit. When something was left out — because the file is longer than the
line bound, or held more transactions than the transaction bound — a quiet line
under the views says so, for example `Showing the first 1,000 transactions.` or
`The file is longer than 20,000 lines; only the beginning was read.` An empty
file says `This file is empty.` instead of drawing three empty panels.
