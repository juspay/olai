# Hledger

A journal is a plain-text book of account: transactions written as a date, a
description and the postings that moved money between accounts, in the syntax
hledger and ledger share. Olai claims the three usual suffixes — `.journal`,
`.hledger` and `.ledger` — and draws a journal read-only, in three views.

## The three views

Above the views is a row of facts about the file — the days it spans, the
transactions and accounts it has, and the commodities it uses — each its own
fact rather than one sentence. When the reader could not make sense of some
lines, the row ends in a button saying how many, and pressing it switches to
Source and scrolls to the first of them.

The page opens on **Transactions**, the file's own order, under a band naming
the month each run of transactions belongs to — a band per RUN, so a file that
goes back to an earlier month starts a new one rather than merging into the
first. Each entry draws its day and its status as a mark — a filled dot for
cleared, a half dot for pending, a ring for unmarked — then the payee, the
note the file wrote after `|`, and the code in parentheses; the comment is
drawn once as the prose it is, with its tags as pills beside it, rather than
the comment repeated and the tags again. The postings under it carry the
account with its parent path muted and its last segment in ink, and the amount
as the file wrote it, so a minus written before a symbol stays where it is
(`-$10`) and the digits keep the grouping the file gave them (`$4,250.00`). A
cost (`@ $271.12`) and a balance assertion (`= $5,123.45`) are drawn beside
the amount in quiet type — the file's own annotation, not something this
reader applies. A posting whose amount was left out of the file and worked out
to balance the rest of its group — the ordinary postings, or the balanced
virtual ones, since an unbalanced `(…)` posting balances nothing — is marked
_inferred_ with a hollow circle, so you can tell the format's arithmetic from
what was written. The date a row draws is the DAY (`Jul 01`), because the band
above already names the month; the whole date is the cell's `title`. Every
amount in the view is one aligned column — the number right-aligned, a suffix
commodity in its own column beside it — so a column of amounts can be read
down rather than across, and the decimals line up whatever side the commodity
was written on.

On a phone the day moves to the payee's line (`01 ● Landlord · rent July`), the
transactions are set apart by a gap rather than by a date column, and the
amounts keep their columns — the account truncating from the left so its last
segment stays visible.

**Balances** is the same file read the other way: every account that was
named, as a tree, with one column per commodity the file uses. Parent accounts
roll their children up, so `assets` shows the sum of everything under it, and
each row carries its own total in the column of the commodity it is in — a
commodity the row does not hold leaves its column blank, and a row with no
total at all shows `—` rather than a zero, because zero and nothing are
different facts. A cell is the number and its sign alone (`19,031.05`,
`-51.88`): the column is headed with the commodity, so repeating it in every
row would say it twice. A parent folds with the chevron beside it, and the
depth control clips the tree to one, two, three or all of its levels. The
chevron shows what is true of that row — `▸` when its children are not on
screen, whether you closed it or the control cut it — and pressing it opens
the parent past the cut, which is you overruling the control for that one
node. The dial stays the dial: changing it drops those overrules, so `1` draws
one level and never two for a branch you had opened earlier. What survives the
dial is your own closes, and both survive a live revision as long as the
account is still in the file: a rewrite of the file that still holds the
account leaves the fold where you put it. A total is this app's arithmetic
rather than anybody's spelling, so it is written in one house style — a symbol
against the number with the minus in front of it (`-$1,200.00`), a word
commodity after the number with a space — and its integer part is grouped in
threes, because a computed number is one you have to read rather than check.

**Source** is the file's own lines, as far as they were read, under a gutter
numbering each one: nothing on that view is re-rendered from the parse, which
is the point of it. The drawing stops where the reading does (the line bound
below), a line longer than the character cut is shortened like any other field,
and a line the reader kept as raw text carries the kind it is — a directive, a
comment, or a line it could not place, marked in alarm. A directive's indented
sub-lines are that directive, and they carry its mark.

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
with rather than the lines hledger would produce from them. A cost is drawn
beside the amount that carries it and a balance assertion beside the amount it
asserts, as the file's own annotation, but neither changes a total: the totals
in the Balances view are the sums of the postings as written.

## Bounds

A journal is read up to 20,000 lines and 1,000 transactions, and no single
field — a description, a comment, an account, a tag or a source line — is
longer than 2,000 characters; the page draws what fit. A field cut in the
middle of an account path keeps its segments whole (`assets:bank:checking` cut
to twelve characters is `assets:bank`, not `assets:bank:`), which means two
accounts whose beginnings are identical past the cut are drawn as ONE row — the
honest cost of a bound, and the reason the Balances tree and the posting above
it always agree about how long an account is. When something was left out —
because the file is longer than the line bound, held more transactions than the
transaction bound, or overran the character cut — a quiet line under the views
says so, for example `Showing the first 1,000 transactions.`, `The file is
longer than 20,000 lines; only the beginning was read.` or `Long lines are cut
at 2,000 characters.` A file with no records at all draws the app's empty state
— the glyph and `No transactions yet` — rather than three empty views.
