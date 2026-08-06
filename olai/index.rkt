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
         racket/match
         (except-in olai/lang/expander #%module-begin)
         olai/lang/walk)

(provide (contract-out
          [struct node-entry ([task task?]
                              [parent (or/c string? #f)]
                              [file (or/c path? string?)])]
          [outline-index (-> list? hash?)]
          [node-ancestors (-> hash? node-entry? list?)]))

;; One node, addressed: the node itself, the KEY of its parent (#f at a file's
;; top level), and the file it was reached through, as the loaded set named it.
;; Parent as a key rather than a node is what keeps the trail a walk over this
;; hash instead of a second tree hanging off it. The file is kept as a file —
;; what a human should READ it as is the drawing layer's call (olai/paths,
;; file-label), and a basename here would be an address nothing could write to.
(struct node-entry (task parent file) #:transparent)

;; files-data (see olai/store) -> hash key -> node-entry. Keys come from the
;; model (task-key), so this is a plain invertible hash: no id formula
;; restated anywhere, no scan when a lookup misses. First site wins — two
;; roots sharing an @include fragment are one node, indexed once.
(define (outline-index files-data)
  (define idx (make-hash))
  (for ([e (in-list files-data)])
    (match-define (list file tasks) e)
    (fold-tasks
     tasks
     (λ (tk path acc)
       (define key (task-key tk))
       (unless (hash-has-key? idx key)
         (hash-set! idx key (node-entry tk (parent-key path) file)))
       acc)
     idx))
  idx)

;; fold-tasks hands each node its ancestors, outermost first. The last of them
;; is its parent; a top-level node has none.
(define (parent-key path)
  (and (pair? path) (task-key (last path))))

;; The trail ABOVE a node, outermost first, not including the node itself: the
;; file it was reached through, then one (list title key) per ancestor — a
;; name and the address that name is at.
;;
;; It takes an ENTRY, not a key: this is asked about a node you have. A key the
;; index does not know names no node, and whoever looked it up already has to
;; say so — answering "no trail" here would be a second, quieter way to find
;; out, in the module least able to do anything about it.
;;
;; O(depth), walked for the one node someone zoomed to. Keeping every node's
;; trail in the index instead would build it per LOAD and hold it for the life
;; of the snapshot — a file save's worth of work, and O(nodes × depth) of live
;; list, for a question a page asks about one node at a time.
(define (node-ancestors index entry)
  ;; The file is the entry's own: a parent is indexed in the same walk as its
  ;; children, so nothing above a node can have been reached through another.
  (let up ([k (node-entry-parent entry)] [acc '()])
    (define parent (and k (hash-ref index k #f)))
    (if parent
        (up (node-entry-parent parent)
            (cons (list (task-title (node-entry-task parent)) k) acc))
        ;; An ancestor missing from the index cannot happen (a node is indexed
        ;; with its parent), but stopping here means a partial trail rather
        ;; than a crash if it ever did
        (cons (node-entry-file entry) acc))))
