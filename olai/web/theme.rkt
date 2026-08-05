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
         racket/string
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
          ;; every theme the sheet carries, in table order. The page picks one
          ;; by name; this is the list of what it may say, and the picker's rows
          [theme-names (listof string?)]
          ;; the attribute a page names a theme with. The picker writes it and
          ;; the sheet keys off it, so it is one string, spelled here
          [theme-attribute string?]
          ;; the theme a page with no attribute reads in — the sheet's bare
          ;; :root. The picker needs it to light a chip before anyone picks
          [theme-default string?]
          ;; what <meta name="color-scheme"> should say before the sheet lands:
          ;; every way the themes come, said once
          [theme-color-scheme string?]
          ;; the themes that promise AA contrast on every foreground it paints
          ;; on a background. A claim, so something can check it
          [aa-theme-names (listof string?)]
          ;; one theme's table: (token . value), the row the sheet below is
          ;; generated from. `list?` and not the shape: the shape is what the
          ;; load-time guards check, once, rather than on every read
          [theme-entries (-> string? list?)]
          ;; name -> the css fragment that puts that theme in force. What
          ;; lands in the sheet, handed over rather than found in its text
          [theme-blocks (-> list?)]))

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
;; table: adding a theme is adding a row, deleting one is deleting a row, and
;; neither touches a line of CSS. A theme's values are written once, in the
;; block that puts that theme in force — which in hand-written CSS is the same
;; fourteen lines copied once per theme, and one place per theme for a new
;; token to be forgotten.

(struct palette (name scheme aa? entries) #:transparent)

;; `scheme` is the one thing about a theme a browser has to be told in its own
;; words: form controls, scrollbars and the canvas behind the page are the UA's
;; to paint, and `color-scheme` is how it is told which way. It rides in the
;; table because it is a fact about the palette — a theme that changed its mind
;; about being dark and forgot this would keep the OS's scrollbars.
;;
;; `aa?` is a PROMISE, and only some themes make it: every foreground this
;; palette paints on a background clears WCAG AA (4.5:1). Said here so the
;; suite can hold the palette to it — a color nudged by two digits is exactly
;; the edit that quietly drops a pair under the line.
(define (make-palette name #:scheme scheme #:aa? [aa? #f] entries)
  (palette name scheme aa? entries))

(define palettes
  (list
   ;; the leaf the outline is written on: dried palm green, dark-green ink.
   ;; The name is the palette; nothing here is "light".
   (make-palette "leaf" #:scheme 'light
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
   (make-palette "dark" #:scheme 'dark
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
   ;; aged palm leaf, iron-gall ink: the outline as a manuscript. Warm paper,
   ;; brown-black ink, and accents pulled back to what a dye would give.
   (make-palette "manuscript" #:scheme 'light
                 '((paper     . |#F0E7D2|)
                   (paper-2   . |#F5EDDD|)
                   (panel     . |#F7F0E2|)
                   (ink       . |#3D2F1B|)
                   (dim       . |#8C7B5C|)
                   (line      . |#DCCEAC|)
                   (pill-bg   . |#FAF4E6|)
                   (green     . |#5A7A34|)
                   (amber-fg  . |#A05A16|)
                   (amber-bg  . |#F3E2BC|)
                   (blue-fg   . |#2F6580|)
                   (blue-bg   . |#DCE7E4|)
                   (rose-fg   . |#9E4444|)
                   (rose-bg   . |#F1DBD2|)))
   ;; near-white, high contrast: every foreground/background pair clears AA.
   ;; The DEFAULT — what a page reads in before anyone picks — because the one
   ;; nobody chose should be the one that is legible on any screen.
   (make-palette "chalk" #:scheme 'light #:aa? #t
                 '((paper     . |#FAFAF6|)
                   (paper-2   . |#F2F2EC|)
                   (panel     . |#F5F5F0|)
                   (ink       . |#15180F|)
                   (dim       . |#555E4C|)
                   (line      . |#C9CDBF|)
                   (pill-bg   . |#EDEFE6|)
                   (green     . |#2A6626|)
                   (amber-fg  . |#8F5200|)
                   (amber-bg  . |#F5E4BE|)
                   (blue-fg   . |#134F75|)
                   (blue-bg   . |#D4E5EF|)
                   (rose-fg   . |#8E3348|)
                   (rose-bg   . |#F4D7DD|)))
   ;; true black: an OLED panel spends nothing on #000000, and the outline is
   ;; mostly background. Everything else is the dark theme, one step quieter.
   (make-palette "pitch" #:scheme 'dark
                 '((paper     . |#000000|)
                   (paper-2   . |#0D110A|)
                   (panel     . |#10140C|)
                   (ink       . |#C9D6B4|)
                   (dim       . |#77836A|)
                   (line      . |#242B1E|)
                   (pill-bg   . |#161B10|)
                   (green     . |#7FC97A|)
                   (amber-fg  . |#D9A85A|)
                   (amber-bg  . |#2C230B|)
                   (blue-fg   . |#6FAECE|)
                   (blue-bg   . |#122633|)
                   (rose-fg   . |#D68B9A|)
                   (rose-bg   . |#301820|)))))

(define theme-names (map palette-name palettes))

(define aa-theme-names
  (for/list ([p (in-list palettes)] #:when (palette-aa? p)) (palette-name p)))

;; Two themes with one name is one block overwriting the other, and a picker
;; with two chips that do the same thing.
(unless (= (length theme-names) (length (remove-duplicates theme-names)))
  (error 'theme "two themes share a name: ~s" theme-names))

;; A token a theme forgets is a var(--x) that resolves to nothing the moment
;; that theme is picked. Cheap to check here, invisible in a browser.
(for ([p (in-list palettes)])
  (unless (equal? (map car (palette-entries p)) palette-tokens)
    (error 'theme "theme ~a names ~s, not the skin's tokens ~s"
           (palette-name p) (map car (palette-entries p)) palette-tokens)))

;; ---- policy ---------------------------------------------------------------
;;
;; Which theme a page gets when it says nothing. Named, because the generators
;; below only know that some theme fills the role — and the picker needs it
;; too, to light the chip that is in force before anyone has picked one.
;;
;; The OS does not vote. `prefers-color-scheme` chose the theme once, and it
;; meant two ways to be dark that could disagree; a theme is a PICK, and an
;; unpicked page reads in the default.

(define theme-default "chalk")

;; How a page says which theme it is in: one attribute, keyed on by the sheet,
;; written by the picker (web/prefs), and spelled here.
(define theme-attribute "data-theme")
(define theme-attribute-datum (string->symbol theme-attribute))

;; What the browser should assume BEFORE the sheet lands, which is every way
;; these themes come — it cannot know yet which one this page is in. Once the
;; sheet is in, each theme's own color-scheme is what wins.
(define theme-color-scheme
  (string-join
   (remove-duplicates (for/list ([p (in-list palettes)])
                        (symbol->string (palette-scheme p))))
   " "))

(define (theme-named name)
  (or (findf (λ (p) (equal? (palette-name p) name)) palettes)
      (error 'theme "no theme named ~a" name)))

(define (theme-entries name) (palette-entries (theme-named name)))

;; ---- the generators -------------------------------------------------------

(define (custom-property name) (string->keyword (string-append "--" name)))

;; --paper: #E4ECCA; ... — one theme's values, in force, and the one
;; declaration that is not a custom property: color-scheme is what the BROWSER
;; paints from (form controls, scrollbars, the canvas), and it belongs wherever
;; a theme is put in force, which is exactly here.
(define (palette-mapping p)
  (append
   (list '#:color-scheme (palette-scheme p))
   (append*
    (for/list ([entry (in-list (palette-entries p))])
      (list (custom-property (symbol->string (car entry))) (cdr entry))))))

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

;; The block that puts ONE theme in force. Every theme's is the selector a page
;; asks for it by; the DEFAULT's also lands on a bare :root, because a page that
;; picked nothing is in it — same mapping, so one block rather than two.
;;
;; Handed out below (theme-blocks) as well as registered: a reader that went
;; looking for these in the sheet's text would be finding them by the spelling
;; they happen to have rather than being given them.
(define (theme-block p)
  (if (equal? (palette-name p) theme-default)
      (css-expr [(: root)
                 (attribute (: root) (= ,theme-attribute-datum ,(palette-name p)))
                 ,@(palette-mapping p)])
      (css-expr [(attribute (: root) (= ,theme-attribute-datum ,(palette-name p)))
                 ,@(palette-mapping p)])))

(define theme-block-alist
  (for/list ([p (in-list palettes)]) (cons (palette-name p) (theme-block p))))

(define (theme-blocks) theme-block-alist)

(define (theme-block-named name) (cdr (assoc name theme-block-alist)))

;; the default first: it is what a page with no theme reads in
(register-base! (theme-block-named theme-default))

;; and every other theme, for a page that asked for it by name. Last, so the
;; named theme wins over the bare :root above.
(for ([name (in-list theme-names)] #:unless (equal? name theme-default))
  (register-base! (theme-block-named name)))

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
