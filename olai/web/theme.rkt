#lang racket/base

;; olai skin — paper-and-ink palette; Workflowy-faithful outline chrome.
;;
;; The design tokens and the document's base rules. Nothing here draws a
;; component: it hands the rest of the web layer a vocabulary (var(--ink),
;; var(--radius)) and a page that is already the right color.
;;
;; Require this FIRST. The registry's order is the cascade (see style.rkt), and
;; everything downstream reads tokens this module defines.

(require racket/list
         racket/contract
         olai/web/style)

(provide (contract-out
          ;; the body's class: the page shell wears it, and the outline pane
          ;; and chat panel hang their layout off it
          [sf-body string?]))

;; ---- palettes -------------------------------------------------------------
;;
;; Each palette is written ONCE, as raw values under a prefix. The three
;; mappings below name a palette to the rest of the skin — light by default,
;; dark when the OS says so, and either one when the page carries data-theme —
;; and they are GENERATED from these lists. In hand-written CSS that mapping is
;; the same fourteen lines copied three times, which is three places for a new
;; token to be forgotten.

(define light
  '((paper     . |#E4ECCA|)
    (paper-2   . |#EDF2DC|)
    (panel     . |#EFF4DC|)
    (ink       . |#2C4222|)
    (dim       . |#74855F|)
    (line      . |#CDD8AB|)
    (pill-bg   . |#F5F8E6|)
    (green     . |#3E7A3A|)
    (amber-fg  . |#B9741B|)
    (amber-bg  . |#F7E9C8|)
    (blue-fg   . |#2B6A8F|)
    (blue-bg   . |#D8E8EF|)
    (rose-fg   . |#A84A5E|)
    (rose-bg   . |#F5DBDF|)))

(define dark
  '((paper     . |#1E2417|)
    (paper-2   . |#252D1D|)
    (panel     . |#272F1E|)
    (ink       . |#DBE7C9|)
    (dim       . |#8FA077|)
    (line      . |#33402A|)
    (pill-bg   . |#2A3320|)
    (green     . |#8FD08A|)
    (amber-fg  . |#E6B366|)
    (amber-bg  . |#3D310F|)
    (blue-fg   . |#7DB8D8|)
    (blue-bg   . |#1D3340|)
    (rose-fg   . |#E396A5|)
    (rose-bg   . |#402028|)))

;; A token that exists in one palette and not the other is a var(--x) that
;; resolves to nothing after dark. Cheap to check here, invisible in a browser.
(unless (equal? (map car light) (map car dark))
  (error 'theme "palettes name different tokens: ~s vs ~s"
         (map car light) (map car dark)))

(define tokens (map car light))

(define (custom-property name) (string->keyword (string-append "--" name)))

(define (prefixed prefix token) (string-append prefix "-" (symbol->string token)))

;; --l-paper: #E4ECCA; ... — one palette, spelled out
(define (palette-declarations prefix palette)
  (append*
   (for/list ([entry (in-list palette)])
     (list (custom-property (prefixed prefix (car entry))) (cdr entry)))))

;; --paper: var(--l-paper); ... — the same names, pointed at one palette
(define (palette-mapping prefix)
  (append*
   (for/list ([token (in-list tokens)])
     (list (custom-property (symbol->string token))
           (list 'apply 'var (string->symbol (string-append "--" (prefixed prefix token))))))))

;; ---- tokens ---------------------------------------------------------------

(register-fragment!
 (css-expr
  [(: root)
   ,@(palette-declarations "l" light)
   ,@(palette-declarations "d" dark)

   #:--sans ui-sans-serif system-ui -apple-system "Segoe UI" Roboto
            "Helvetica Neue" Arial sans-serif
   #:--mono ui-monospace SFMono-Regular "SF Mono" Menlo Consolas
            "Liberation Mono" monospace

   #:--sidebar-w 15rem
   #:--chat-w (apply max 21rem 33vw)
   #:--indent 1.375rem
   #:--radius 0.375rem]))

(register-fragment!
 (css-expr
  [(: root) (attribute (: root) (= data-theme "light"))
   ,@(palette-mapping "l")]))

(register-fragment!
 (css-expr
  [@ media (#:prefers-color-scheme dark)
     [(: root) ,@(palette-mapping "d")]]))

(register-fragment!
 (css-expr
  [(attribute (: root) (= data-theme "dark"))
   ,@(palette-mapping "d")]))

;; ---- base -----------------------------------------------------------------

(register-fragment!
 (css-expr
  [* (:: * before) (:: * after) #:box-sizing border-box]
  [html #:-webkit-text-size-adjust 100%]))

(define-style sf-body #:tag body
  #:margin 0
  #:min-height 100vh
  #:display flex
  #:align-items stretch
  #:background (apply var --paper)
  #:color (apply var --ink)
  #:font-family (apply var --sans)
  #:font-size 15px
  #:line-height 1.5)

(register-fragment! (css-expr [a #:color inherit]))

;; The focus ring is the document's, not any one control's: every button,
;; link and input in the skin is focusable, and none of them draw their own.
(register-fragment!
 (css-expr
  [(: focus-visible) #:outline (2px solid (apply var --green)) #:outline-offset 2px]))
