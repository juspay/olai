#lang arch

;; The core: the data model, the queries over it, the writes, and the two
;; programs at the top. It settles — a feature adds a query or an op here every
;; few weeks — and it sits above `lang/` and below `web/`.
(clock settling)

;; Nothing ambient by default. Everything below that reaches for the world says
;; so, which is what makes "pure logic takes what it needs as an argument" a
;; check rather than a hope.
(owns)

;; ---- the pieces that hold still ----------------------------------------------

;; Where the clock enters this codebase, and the only place. `today-iso-string`
;; is a clock read wearing a different name, so it is declared as one: every
;; module that calls it is reading the clock as surely as one calling gregor's
;; `(today)`, and check 2 knows it.
;;
;; It also owns the MONTH LAYOUT — where the days of a month land on a
;; Mon-first grid — which arrived with `olai calendar` and outlived it: the
;; command is gone, and a surface that draws a month still has to be told
;; where the 1st goes. Pure arithmetic over a year-month, and `today` reaches
;; it as an argument like everywhere else.
(override "dates.rkt"
          (clock stable)
          (owns (clock "today-iso-string"))
          (concept month-layout "week-days" "month-grid-dates"
                   "parse-year-month" "format-year-month" "shift-year-month"))

;; What a @doc path means, and what a failure a person reads looks like.
;; Neither has changed since it was written, and the language depends on the
;; first of them.
(override "doc.rkt" (clock stable) (owns filesystem))
(override "fail.rkt" (clock stable))

;; What an @include path names — where a relative one resolves to, whether a
;; starred one names a given file, and the directory it reads to answer. Same
;; standing as doc.rkt and for the same two reasons: it is a closed pattern
;; grammar that changes when the grammar does, and `lang/` — which is stable —
;; depends on it, so it cannot be less stable than its caller. The reading is
;; the whole of what it does, so it says so.
;;
;; The resolution is a concept because it had been written twice: the expander
;; splices what it names, and `daily` asks whether a root already includes the
;; fragment it is about to write. Two answers to that is two ideas of which
;; file an outline means.
(override "glob.rkt" (clock stable) (owns filesystem)
          (concept include-resolution "include-absolute"))

;; A node's name on disk and in a URL: one owner, so a renderer never grows its
;; own copy and the core keeps building without web/.
(override "paths.rkt" (owns filesystem) (concept file-naming "file-label" "key-label"))

;; ---- the load layer ------------------------------------------------------------

;; Node keys are minted HERE. A module cannot mint its own: it knows only its
;; own entry point, and the same node reached through a different root has to
;; key the same.
;;
;; And it reads a file: `outline-lang` opens a candidate to see which `#lang`
;; it is in, which is how a `.rkt` under a served directory that is not an
;; outline is passed over instead of loaded. The alternative was to hand the
;; answer in as an argument, which would have put "which languages are ours"
;; in every caller instead of in the layer that loads them. This module has
;; always read files — `dynamic-require` is a read the checker cannot see —
;; so the declaration is catching up with what it does.
(override "load.rkt" (owns filesystem) (concept node-key-minting "mint-*"))

;; The graph beyond containment, derived once per load: what the typed edges
;; mean once both spellings are folded into one, which way round, and what
;; points back at a node. One owner, because a second module that inverted
;; `@blocks` its own way would be a second graph.
;;
;; The names are written out rather than starred: `edge-*` would reach into
;; lang/expander's `edge-ref`, which is the language's word for what a file
;; WROTE, and a concept that claimed both would be claiming two different
;; things one directory apart.
(override "edges.rkt"
          (concept edge-derivation "build-edge-index" "empty-edge-index"
                   "edge-index*" "edge-graph" "edge-targets" "edge-backlinks"
                   "edge-order" "edge-node" "backlink*"))

;; Snapshots, and the namespace an outline is loaded in. Addressing is not
;; snapshotting — the index is olai/index.rkt's — so the concept here is the
;; snapshot and what holds it.
(override "store.rkt"
          (owns filesystem)
          (concept outline-snapshots "snapshot*" "store-*" "make-store"))

;; Where done work goes. One file name, and the two predicates everything else
;; asks instead of spelling it: the op writes it, the queries skip it, the web
;; view draws it on a page of its own — and none of the three gets to have its
;; own idea of what "archived" means.
(override "archive.rkt"
          (concept archived-work "archive-file-name" "archive-path-for"
                   "archived-file?" "archived-task?"))

;; What the day journal is CALLED, and how its months are named — the same
;; split, one root over: the sidebar draws it as a month, `olai daily` fills it
;; in, and neither gets its own idea of which file the diary is. Pure naming,
;; so it is here rather than beside the write that uses it — a renderer asking
;; "is this root the journal" must not pull the write path onto the page.
;; Where the days LAND on a grid is not here: that is arithmetic over a
;; year-month and it belongs to dates.rkt's month-layout, whoever draws it.
;; What is here is the journal's own — which file it is, what its months are
;; called, and one month of ITS days as a value.
(override "journal.rkt"
          (concept day-journal "daily-file-name" "daily-file?" "month-name"
                   "month-fragment-rel" "day-month*"))

;; ---- the writes ------------------------------------------------------------------

;; Every write goes through a file on disk, and one of them also goes through
;; git.
(override "edit.rkt" (owns filesystem subprocess))
(override "ops.rkt" (owns filesystem))
(override "daily.rkt" (owns filesystem))
(override "resolve.rkt" (owns filesystem))

;; Sibling `ord` keys: midpoint between two fractional-index strings. Pure;
;; writers call it when inserting a child. (jsonl-edit.rkt is package-default:
;; pure text mutators, no ambient authority.)
(override "frac.rkt"
          (clock stable)
          (concept fractional-ord "ord-alphabet" "ord-char?" "ord-string?"
                   "ord-first" "ord-after" "ord-before" "ord-between"))

;; ---- the agent -------------------------------------------------------------------

;; One subprocess, one protocol, no browser. Nothing else spells ACP: the
;; concept is the whole `acp-` surface, and a name in it appearing anywhere
;; else is the check, not a convention.
(override "acp.rkt"
          (owns filesystem subprocess threads)
          (concept acp-protocol "acp-*" "make-acp-client"))

;; ---- the two programs --------------------------------------------------------------

;; The CLI is app code, not library: it computes `today` and hands it down, it
;; reads and writes files, and it mounts the server — which is what makes it
;; volatile whatever its own churn says.
(override "cli.rkt" (clock volatile) (owns clock filesystem))

;; The facade. It re-exports the data model, the pure queries AND the web
;; render, so it moves with the fastest thing it names.
(override "main.rkt" (clock volatile))
