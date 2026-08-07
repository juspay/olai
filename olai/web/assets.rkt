#lang racket/base

;; The /static/ surface, and nothing that draws.
;;
;; One owner for three facts that have to agree: the directory the server
;; mounts, the URL prefix it mounts it at, and the files a page pulls in from
;; there. They are not a component — nothing here has a look — which is why
;; they are not in one.

(require racket/contract
         racket/runtime-path
         ;; which files paint a fenced code block is the business of the module
         ;; that draws one, the same way the framework's runtime is
         ;; live/client's. All that is decided here is that they are mounted
         ;; with the rest of /static/
         (only-in olai/web/markdown highlight-scripts))

(provide (contract-out
          [web-static-dir (-> path?)]
          [web-static-prefix string?]
          [web-scripts (listof string?)]
          [static-href (-> string? string?)]))

;; NO JS lives in a Racket module here — a script that changes with every SSE
;; tweak has no business recompiling one, and browsers cannot cache it. The one
;; script the page carries inline is web/prefs' (it has to run before the first
;; paint, which is the one thing a cacheable deferred file cannot do), and it is
;; that module's.
;;
;; The stylesheet is the other way round: it is NOT a file. It is generated from
;; the modules that draw the page (olai/web/skin), and nothing here can name it
;; — skin requires the drawers, so a drawer asking skin for a URL would be a
;; cycle. web/page is TOLD the href, like every other address it links.

(define-runtime-path static-dir "static")
(define (web-static-dir) static-dir)

(define web-static-prefix "/static/")

;; olai's own scripts. The client runtime (htmx, its SSE extension, idiomorph
;; and the health watchdog) is the framework's, mounted at its own prefix and
;; listed by it — see olai/web/live. These come after, and lean on it.
;; The highlighter is under this prefix and not in this literal: which files
;; paint a fenced code block is web/markdown's to say (see the require above).
(define web-scripts
  (append '("collapse.js" "notes.js" "prefs.js" "search.js" "calendar.js"
            "chat.js" "pwa.js")
          highlight-scripts))

(define (static-href name) (string-append web-static-prefix name))

