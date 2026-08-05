#lang racket/base

;; olai skin — paper-and-ink palette; Workflowy-faithful outline chrome.
;;
;; The design tokens and the document's base rules. It draws no component of
;; its own: it hands the rest of the web layer a vocabulary (`ink`, `radius`,
;; `phone-max`) and a page that is already the right color. The one shape here
;; — the pill — is the exception that proves it: two modules draw one, so
;; neither owns it.
;;
;; Require this FIRST. The registry's order is the cascade (see style.rkt), and
;; everything downstream reads tokens this module defines.

(require racket/list
         racket/contract
         olai/web/style)

(provide (contract-out
          ;; the body's class: the page shell wears it, and the outline pane
          ;; and chat panel hang their layout off it
          [ol-body string?]
          ;; the pill's SHAPE. Two modules draw a pill — web/render a date,
          ;; web/markdown a #tag — so the shape belongs to neither and sits
          ;; here with the rest of the shared vocabulary; each kind repaints
          ;; it in the module that draws it
          [ol-pill string?]
          ;; every theme the sheet carries, in cascade order. The page picks
          ;; one with data-theme; this is the list of what it may say
          [theme-names (listof string?)]))

;; The tokens themselves are bound and provided by define-tokens below.

;; Everything here is the cascade's BASE layer — the tokens, and the rules the
;; document itself wears — so it is said once, here, rather than on every
;; fragment below (see style.rkt on layers).
(define (register-base! fragment) (register-fragment! fragment #:layer 'base))

;; The one raw-string fragment in the skin: css-expr has no comment form, and
;; a generated file that does not say so is a file somebody edits by hand.
(register-base!
 (string-append
  "/* olai skin — GENERATED from the Racket modules that draw the page;\n"
  "   olai/web/skin.rkt says which ones, and in what order.\n"
  "   Do not edit: edit the module that owns the component. */"))

;; ---- the vocabulary -------------------------------------------------------
;;
;; Spelled ONCE, here: the same identifiers are the list the generators below
;; fold over and the value every module writes when it wants the color
;; (`,ink`). A token that is not in this list is not a token.

(define-tokens palette-tokens
  paper paper-2 panel ink dim line pill-bg green
  amber-fg amber-bg blue-fg blue-bg rose-fg rose-bg)

;; The rest of the vocabulary: shape and type, which do not change with the
;; theme, so they are declared once and never mapped.
(define-tokens layout-tokens
  sans mono sidebar-w chat-w indent radius)

;; Three constants that are not custom properties because CSS cannot read one
;; where they are used — a media query's width, and two values a rule repeats
;; verbatim. They are still the skin's, and still spelled once.
(provide phone-max busy-beat micro-size)

;; where two columns stop fitting: no sidebar beside the outline, no panel
;; beside either
(define phone-max '48rem)
;; the rhythm a running turn breathes at, in the toggle's ring and the
;; header's dot — one turn, one tempo
(define busy-beat '1.8s)
;; the smallest type in the skin: a label, a timestamp, a tool line
(define micro-size '0.6875rem)

;; ---- the themes -----------------------------------------------------------
;;
;; A theme is a palette with a name, and the whole file is generated from this
;; table: adding a theme is adding a row. Values are written ONCE, under a
;; one-letter prefix (--l-paper, --d-paper), and the mapping that points the
;; skin's names at one of them is emitted per theme — in hand-written CSS that
;; is the same fourteen lines copied once per theme, which is one place per
;; theme for a new token to be forgotten.

(struct palette (name prefix entries) #:transparent)

;; The prefix is the name's first letter: short, and nothing to keep in step.
(define (make-palette name entries)
  (palette name (substring name 0 1) entries))

(define palettes
  (list
   (make-palette "light"
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
   (make-palette "dark"
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
                   (rose-bg   . |#402028|)))))

(define theme-names (map palette-name palettes))

;; Two themes whose names start with the same letter would declare the same
;; --x-token twice, and the second would win everywhere.
(let ([prefixes (map palette-prefix palettes)])
  (unless (= (length prefixes) (length (remove-duplicates prefixes)))
    (error 'theme "two themes share a prefix: ~s" prefixes)))

;; A token a theme forgets is a var(--x) that resolves to nothing the moment
;; that theme is picked. Cheap to check here, invisible in a browser.
(for ([p (in-list palettes)])
  (unless (equal? (map car (palette-entries p)) palette-tokens)
    (error 'theme "theme ~a names ~s, not the skin's tokens ~s"
           (palette-name p) (map car (palette-entries p)) palette-tokens)))

;; ---- policy ---------------------------------------------------------------
;;
;; Which theme a page gets when it says nothing, and which one the OS means
;; when it says it prefers dark. Named, because the generators below only know
;; that some theme fills each role.

(define default-theme "light")
(define os-dark-theme "dark")

(define (theme-named name)
  (or (findf (λ (p) (equal? (palette-name p) name)) palettes)
      (error 'theme "no theme named ~a" name)))

;; ---- the generators -------------------------------------------------------

(define (custom-property name) (string->keyword (string-append "--" name)))

(define (prefixed p token)
  (string-append (palette-prefix p) "-" (symbol->string token)))

;; --l-paper: #E4ECCA; ... — one theme's values, spelled out
(define (palette-declarations p)
  (append*
   (for/list ([entry (in-list (palette-entries p))])
     (list (custom-property (prefixed p (car entry))) (cdr entry)))))

;; --paper: var(--l-paper); ... — the skin's names, pointed at one theme
(define (palette-mapping p)
  (append*
   (for/list ([token (in-list palette-tokens)])
     (list (custom-property (symbol->string token))
           (list 'apply 'var (string->symbol (string-append "--" (prefixed p token))))))))

;; every theme's raw values, one block
(register-base!
 (css-expr
  [(: root)
   ,@(append* (for/list ([p (in-list palettes)]) (palette-declarations p)))]))

;; shape and type: the same in every theme, so its own block
(register-base!
 (css-expr
  [(: root)
   #:--sans ui-sans-serif system-ui -apple-system "Segoe UI" Roboto
            "Helvetica Neue" Arial sans-serif
   #:--mono ui-monospace SFMono-Regular "SF Mono" Menlo Consolas
            "Liberation Mono" monospace

   #:--sidebar-w 15rem
   #:--chat-w (apply max 21rem 33vw)
   #:--indent 1.375rem
   #:--radius 0.375rem]))

;; the default, and the page that names it out loud — one block, because they
;; are the same mapping
(register-base!
 (css-expr
  [(: root) (attribute (: root) (= data-theme ,default-theme))
   ,@(palette-mapping (theme-named default-theme))]))

;; the OS's preference, for a page that named nothing
(register-base!
 (css-expr
  [@ media (#:prefers-color-scheme dark)
     [(: root) ,@(palette-mapping (theme-named os-dark-theme))]]))

;; and every other theme, for a page that asked for it. The default is already
;; spelled above; repeating it here would be the same declarations twice.
(for ([p (in-list palettes)]
      #:unless (equal? (palette-name p) default-theme))
  (register-base!
   (css-expr
    [(attribute (: root) (= data-theme ,(palette-name p)))
     ,@(palette-mapping p)])))

;; ---- base -----------------------------------------------------------------

(register-base!
 (css-expr
  [* (:: * before) (:: * after) #:box-sizing border-box]
  [html #:-webkit-text-size-adjust 100%]))

;; The page IS the layout: sidebar and main pane are its two flex children.
;; On a phone there is no room for two columns, so the same two stack — the
;; only rule about the document as a whole, and it lives with the document.
(define-style ol-body #:tag body #:layer 'base
  #:margin 0
  #:min-height 100vh
  #:display flex
  #:align-items stretch
  #:background ,paper
  #:color ,ink
  #:font-family ,sans
  #:font-size 15px
  #:line-height 1.5
  [@ media (#:max-width ,phone-max) #:flex-direction column])

(register-base! (css-expr [a #:color inherit]))

;; One shape, three readings: a date, a done date, a #tag. The shape is the
;; skin's, like the focus ring below — the modules that draw a pill only say
;; how their kind is painted, and their rules land after this one.
(define-style ol-pill #:layer 'base
  #:display inline-flex
  #:align-items center
  #:gap 0.25rem
  #:border-radius 9999px
  #:padding (0.0625rem 0.5rem)
  #:font-size 0.75rem
  #:line-height 1.4
  #:white-space nowrap
  #:background ,pill-bg
  #:color ,dim
  #:border (1px solid transparent))

;; The focus ring is the document's, not any one control's: every button,
;; link and input in the skin is focusable, and none of them draw their own.
(register-base!
 (css-expr
  [(: focus-visible) #:outline (2px solid ,green) #:outline-offset 2px]))
