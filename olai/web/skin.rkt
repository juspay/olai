#lang racket/base

;; The skin, assembled: what the stylesheet is made of, and where a browser
;; asks for it.
;;
;; ORDER IS THE CASCADE (see style.rkt): a fragment's layer decides first, and
;; inside a layer the modules come out in the order they were instantiated —
;; which is the order they are required. That order is written out below rather
;; than left to whichever module happened to pull which.
;;
;; Requiring this module IS building the sheet, so nothing else may spell the
;; composition: a server that required only the modules it draws with would
;; serve a stylesheet missing whatever it did not happen to need.

(require racket/contract
         ;; tokens and the document's own rules, first
         olai/web/theme
         ;; what a rendered title or note wears
         olai/web/markdown
         ;; the outline: one module per surface, and web/render is where THEIR
         ;; order is written out. Nested composition, single owner at each
         ;; level — two files naming one order would be two to keep in step
         olai/web/render
         ;; the two surfaces that overlay it: the agent's panel, and the
         ;; palette a query opens
         olai/web/chat-panel
         olai/web/search
         (only-in olai/web/style stylesheet))

(provide ;; the sheet those modules add up to. Re-exported, not wrapped: the
         ;; mechanism is style.rkt's and the contract with it
         stylesheet
         (contract-out
          ;; the URL the page links and the server answers. The sheet is not a
          ;; file; this is the only place its name is spelled
          [stylesheet-href string?]))

(define stylesheet-href (string-append web-static-prefix "app.css"))
