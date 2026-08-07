#lang racket/base

;; THE OUTLINE PANE: one section per file, the file's top level under it.
;;
;; The main surface, and the thing a live update is about — it sits inside the
;; region web/page draws, so an `outline` event re-fetches the page and morphs
;; this back onto itself. All it does is stack nodes (web/node) under a
;; heading; anything visible about a NODE is that module's.

(require racket/contract
         racket/match
         ;; one owner for how a file is named in the UI (core, not web)
         (only-in olai/paths file-label)
         olai/web/theme
         olai/web/style
         (only-in olai/web/address id-safe)
         (only-in olai/web/node render-child))

(provide (contract-out
          [render-outline
           (->* (list? #:today string? #:node-href (-> string? string?))
                (#:toggle-base (or/c string? #f) #:docs hash?)
                list?)]
          [render-file-section
           (->* (any/c #:today string? #:node-href (-> string? string?))
                (#:toggle-base (or/c string? #f) #:docs hash?)
                list?)]
          ;; the same normalisation the sidebar draws its tree from: two
          ;; surfaces over one files-data, and one answer to what a label is
          [normalize-files-data (-> list? list?)])
         ;; the pane wrapper and the root list the zoom draws its own version
         ;; of: one layer, two modules, no contract between them
         ol-pane ol-outline)

;; files-data -> (listof (list label tasks)) with labels as strings
(define (normalize-files-data files-data)
  (for/list ([e (in-list files-data)])
    (match e
      [(list label (? list? tasks)) (list (file-label label) tasks)]
      [_ (error 'render "bad files-data entry: ~e" e)])))

;; A pane wrapper the SSE swap and the tests address. Nothing paints it.
(define-modifier ol-pane)

;; The outline's own list: same reset as .ol-children, no connector — a file's
;; top level has no parent to hang off.
(define-style ol-outline #:list-style none #:margin 0 #:padding 0)

;; Files stack; the gap between two of them is what says they are two.
(define-style ol-file [(+ & &) #:margin-top 2.5rem])

(define-style ol-file-title
  #:margin (0 0 0.75rem 0.25rem)
  #:font-family ,mono
  #:font-size 0.75rem
  #:font-weight 600
  #:letter-spacing 0.06em
  #:text-transform uppercase
  #:color ,dim)

;; One file's section. This is the natural re-render unit for a watcher: a
;; save touches one file, and #ol-file-<label> is what it swaps.
(define (render-file-section entry
                             #:today today
                             #:node-href node-href
                             #:toggle-base [toggle-base #f]
                             #:docs [docs (hash)])
  (match-define (list label tasks) (car (normalize-files-data (list entry))))
  `(section ((class ,ol-file)
             (id ,(string-append "ol-file-" (id-safe label)))
             (data-file ,label))
            (h2 ((class ,ol-file-title)) ,label)
            (ul ((class ,ol-outline))
                ,@(for/list ([tk (in-list tasks)])
                    (render-child tk
                                  #:site #f
                                  #:owner (id-safe label)
                                  #:today today
                                  #:node-href node-href
                                  #:toggle-base toggle-base
                                  #:docs docs)))))

(define (render-outline files-data
                        #:today today
                        #:node-href node-href
                        #:toggle-base [toggle-base #f]
                        #:docs [docs (hash)])
  `(div ((class ,ol-pane) (id "ol-outline"))
        ,@(for/list ([e (in-list files-data)])
            (render-file-section e
                                 #:today today
                                 #:node-href node-href
                                 #:toggle-base toggle-base
                                 #:docs docs))))

