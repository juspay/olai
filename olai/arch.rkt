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
(override "dates.rkt" (clock stable) (owns (clock "today-iso-string")))

;; What a @doc path means, and what a failure a person reads looks like.
;; Neither has changed since it was written, and the language depends on the
;; first of them.
(override "doc.rkt" (clock stable) (owns filesystem))
(override "fail.rkt" (clock stable))

;; A node's name on disk and in a URL: one owner, so a renderer never grows its
;; own copy and the core keeps building without web/.
(override "paths.rkt" (owns filesystem) (concept file-naming "file-label" "key-label"))

;; ---- the load layer ------------------------------------------------------------

;; Node keys are minted HERE. A module cannot mint its own: it knows only its
;; own entry point, and the same node reached through a different root has to
;; key the same.
(override "load.rkt" (concept node-key-minting "mint-*"))

;; Snapshots, and the namespace an outline is loaded in. Addressing is not
;; snapshotting — the index is olai/index.rkt's — so the concept here is the
;; snapshot and what holds it.
(override "store.rkt"
          (owns filesystem)
          (concept outline-snapshots "snapshot*" "store-*" "make-store"))

;; ---- the writes ------------------------------------------------------------------

;; Every write goes through a file on disk, and one of them also goes through
;; git.
(override "edit.rkt" (owns filesystem subprocess))
(override "ops.rkt" (owns filesystem))
(override "daily.rkt" (owns filesystem))
(override "resolve.rkt" (owns filesystem))

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
