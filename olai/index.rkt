#lang racket/base

;; Node identity, inverted — and what sits above a node.
;;
;; A key is minted by the load layer (olai/load, mint-task-keys) and is the
;; only name anything outside the tree uses: a permalink, an SSE swap target,
;; a stored collapse state. This module is the inverse of that minting — key
;; -> the node and where it hangs — plus the one question the "where" is kept
;; for: the trail of ancestors above a node, which is what a breadcrumb is
;; drawn from.
;;
;; It is not the store. The store decides WHEN the outlines are re-read; this
;; decides HOW a node is addressed, and the two move on different clocks. A
;; hash and a walk up it, no I/O, no clocks, no mutation after the build.
;;
;; Mirrors are not indexed: a mirror site is the same node as its defining
;; site, and that site owns the key.

(require racket/contract
         racket/list
         (except-in olai/lang/expander #%module-begin)
         olai/lang/walk
         ;; one owner for how a file is named in the UI (core, not web)
         (only-in olai/paths file-label))

(provide (contract-out
          [struct node-entry ([task task?]
                              [parent (or/c string? #f)]
                              [file string?])]
          [outline-index (-> list? hash?)]
          [node-ancestors (-> hash? node-entry? list?)]))

;; One node, addressed: the node itself, the KEY of its parent (#f at a file's
;; top level), and the label of the file it was reached through. Parent as a
;; key rather than a node is what keeps the trail a walk over this hash
;; instead of a second tree hanging off it.
(struct node-entry (task parent file) #:transparent)

;; files-data (see olai/store) -> hash key -> node-entry. Keys come from the
;; model (task-key), so this is a plain invertible hash: no id formula
;; restated anywhere, no scan when a lookup misses. First site wins — two
;; roots sharing an @include fragment are one node, indexed once.
(define (outline-index files-data)
  (define idx (make-hash))
  (for ([e (in-list files-data)])
    (define label (file-label (car e)))
    (fold-tasks
     (cadr e)
     (λ (tk path acc)
       (unless (hash-has-key? idx (task-key tk))
         (hash-set! idx (task-key tk) (node-entry tk (parent-key path) label)))
       acc)
     idx))
  idx)

;; fold-tasks hands each node its ancestors, outermost first. The last of them
;; is its parent; a top-level node has none.
(define (parent-key path)
  (and (pair? path) (task-key (last path))))

;; The trail ABOVE a node, outermost first, not including the node itself: the
;; file it was reached through as a bare label, then one (list title key) per
;; ancestor. That is exactly what render-breadcrumbs draws — a label with
;; nowhere to go, then crumbs that are nodes.
;;
;; It takes an ENTRY, not a key: this is asked about a node you have. A key the
;; index does not know names no node, and whoever looked it up already has to
;; say so — answering "no trail" here would be a second, quieter way to find
;; out, in the module least able to do anything about it.
;;
;; O(depth), asked about the one node someone zoomed to. Keeping the whole
;; trail for every node in the index would pay for it per LOAD instead — a
;; file save's worth of work for a question a page asks about one node.
(define (node-ancestors index entry)
  (let up ([k (node-entry-parent entry)] [file (node-entry-file entry)] [acc '()])
    (define parent (and k (hash-ref index k #f)))
    (if parent
        (up (node-entry-parent parent)
            (node-entry-file parent)
            (cons (list (task-title (node-entry-task parent)) k) acc))
        ;; the top: the file the trail hangs off. An ancestor missing from the
        ;; index cannot happen (a node is indexed with its parent), but
        ;; stopping here means a partial trail rather than a crash if it did
        (cons file acc))))
