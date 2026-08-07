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
          ;; what <meta name="theme-color"> says before the sheet (and before
          ;; pwa.js rewrites it from --paper): the default theme's paper. The
          ;; browser chrome is the page's first paint; inventing a second
          ;; colour here would flash
          [theme-default-paper string?]
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
  sans mono sidebar-w panel-w indent radius)

;; Four constants that are not custom properties because CSS cannot read one
;; where they are used — a media query's width, and three values a rule repeats
;; verbatim. They are still the skin's, and still spelled once.
(provide phone-max busy-beat micro-size touch-min)

;; where two columns stop fitting: no sidebar beside the outline, no panel
;; beside either
(define phone-max '48rem)
;; the rhythm a running turn breathes at, in the toggle's ring and the
;; header's dot — one turn, one tempo
(define busy-beat '1.8s)
;; the smallest type in the skin: a label, a timestamp, a tool line
(define micro-size '0.6875rem)
;; how big a thing a finger aims at has to be — 44px, the number both mobile
;; platforms print in their guidelines. The floating toggle and the panel's
;; controls in sheet mode are the same decision, so it is one binding
(define touch-min '2.75rem)

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
                   (rose-bg   . |#301820|)))

   ;; ---- imported palettes --------------------------------------------------
   ;;
   ;; The rows below are the WorkFlowy desktop themes' COLOR VALUES, read off
   ;; the palettes their app ships and written here as olai rows. Nothing else
   ;; came across: WorkFlowy paints a different app, and none of its rules,
   ;; names or markup are ours to keep. A hex is a fact about a color.
   ;;
   ;; ONE rule maps their vocabulary onto ours, and every row below follows it
   ;; unless it is named as an exception in that row's own comment:
   ;;
   ;;   paper     <- background-primary     the page itself
   ;;   paper-2   <- background-secondary   one step along the paper ramp
   ;;   panel     <- background-tertiary    the third surface (chat panel)
   ;;   ink       <- text-primary
   ;;   dim       <- text-tertiary          their muted body text
   ;;   line      <- border-primary
   ;;   pill-bg   <- background-selected    (= background-info in every theme)
   ;;   green     <- text-green             the checkmark, the focus ring
   ;;   amber-fg  <- text-yellow            #tag
   ;;   amber-bg  <- background-yellow
   ;;   blue-fg   <- text-blue              a date
   ;;   blue-bg   <- background-blue
   ;;   rose-fg   <- text-red               a mirror, an error
   ;;   rose-bg   <- background-red
   ;;
   ;; Two of their slots are deliberately NOT the source. text-quinary is a
   ;; placeholder tone that is invisible on the page in half their themes, so
   ;; dim comes from text-tertiary; and the semantic accents (text-success,
   ;; text-danger, text-warning) are pale mints and pinks that only work on a
   ;; dark ground, so the accents come from their named color ramp instead —
   ;; the one they pair a background with.
   ;;
   ;; Themes of theirs that are a photograph or a pane of glass over one of
   ;; these palettes are not here: without the image they are a duplicate row.

   ;; their default: white page, blue-gray ink.
   (make-palette "light" #:scheme 'light
                 '((paper     . |#FFFFFF|)
                   (paper-2   . |#F3F4F4|)
                   (panel     . |#DCE0E2|)
                   (ink       . |#2A3135|)
                   (dim       . |#868C90|)
                   (line      . |#DCE0E2|)
                   (pill-bg   . |#C1E1F2|)
                   (green     . |#057A55|)
                   (amber-fg  . |#9F580A|)
                   (amber-bg  . |#FCE96A|)
                   (blue-fg   . |#1C64F2|)
                   (blue-bg   . |#C3DDFD|)
                   (rose-fg   . |#E02424|)
                   (rose-bg   . |#FBD5D5|)))
   ;; their dark: charcoal, white ink, a slate-blue chip.
   (make-palette "dark" #:scheme 'dark
                 '((paper     . |#2A3135|)
                   (paper-2   . |#353C3F|)
                   (panel     . |#5C6062|)
                   (ink       . |#FFFFFF|)
                   (dim       . |#9EA1A2|)
                   (line      . |#5C6062|)
                   (pill-bg   . |#336677|)
                   (green     . |#31C48D|)
                   (amber-fg  . |#E3A008|)
                   (amber-bg  . |#8C7146|)
                   (blue-fg   . |#76A9FA|)
                   (blue-bg   . |#405580|)
                   (rose-fg   . |#F98080|)
                   (rose-bg   . |#773B3B|)))
   ;; paper on a gray desk. EXCEPTION: paper is their background-ambient, the
   ;; only body value vintage does not share with their default — the rest of
   ;; what makes it vintage is a dark app frame, and olai has no frame.
   (make-palette "vintage" #:scheme 'light
                 '((paper     . |#ECEEF0|)
                   (paper-2   . |#F3F4F4|)
                   (panel     . |#DCE0E2|)
                   (ink       . |#2A3135|)
                   (dim       . |#868C90|)
                   (line      . |#DCE0E2|)
                   (pill-bg   . |#C1E1F2|)
                   (green     . |#057A55|)
                   (amber-fg  . |#9F580A|)
                   (amber-bg  . |#FCE96A|)
                   (blue-fg   . |#1C64F2|)
                   (blue-bg   . |#C3DDFD|)
                   (rose-fg   . |#E02424|)
                   (rose-bg   . |#FBD5D5|)))
   ;; the mocha one: plum-black page, lavender ink, pastel accents over it.
   ;; EXCEPTION: pill-bg is their background-quaternary — the selected blue-gray
   ;; is close enough to their muted text to swallow a pill's label.
   (make-palette "catppuccin" #:scheme 'dark
                 '((paper     . |#1E1E2E|)
                   (paper-2   . |#343546|)
                   (panel     . |#45475A|)
                   (ink       . |#CDD6F4|)
                   (dim       . |#9399B2|)
                   (line      . |#313244|)
                   (pill-bg   . |#313244|)
                   (green     . |#A6E3A1|)
                   (amber-fg  . |#F9E2AF|)
                   (amber-bg  . |#F9E2AF99|)
                   (blue-fg   . |#89B4FA|)
                   (blue-bg   . |#89B4FA99|)
                   (rose-fg   . |#F38BA8|)
                   (rose-bg   . |#F38BA899|)))
   ;; cocoa and cream: warm paper, near-black cocoa ink, a honey chip.
   (make-palette "chocolate" #:scheme 'light
                 '((paper     . |#FFEFE2|)
                   (paper-2   . |#F0DAC9|)
                   (panel     . |#E6CDBB|)
                   (ink       . |#281603|)
                   (dim       . |#7D5E47|)
                   (line      . |#A1836B53|)
                   (pill-bg   . |#FBDA8A|)
                   (green     . |#2DA044|)
                   (amber-fg  . |#C99A00|)
                   (amber-bg  . |#FFF3C4|)
                   (blue-fg   . |#1A73E8|)
                   (blue-bg   . |#D4E8FF|)
                   (rose-fg   . |#D93636|)
                   (rose-bg   . |#FFE0E0|)))
   ;; a phosphor terminal: black page, lime ink, a green-on-green ramp. The
   ;; accents are the ones they hand every dark theme.
   (make-palette "hacker" #:scheme 'dark
                 '((paper     . |#000000|)
                   (paper-2   . |#002200|)
                   (panel     . |#003300|)
                   (ink       . |#00FF00|)
                   (dim       . |#009900|)
                   (line      . |#005500|)
                   (pill-bg   . |#005500|)
                   (green     . |#31C48D|)
                   (amber-fg  . |#E3A008|)
                   (amber-bg  . |#8C7146|)
                   (blue-fg   . |#76A9FA|)
                   (blue-bg   . |#405580|)
                   (rose-fg   . |#F98080|)
                   (rose-bg   . |#773B3B|)))
   ;; tea powder: green page, darker green ink. TWO EXCEPTIONS, both because
   ;; matcha has one muted tone and one dark surface: dim is their text-quinary
   ;; (text-tertiary is text-primary here, so the rule leaves nothing dim), and
   ;; paper-2 is their background-tertiary (background-secondary is a saturated
   ;; mid-green that leaves a chip's label at 1.5:1).
   (make-palette "matcha" #:scheme 'light
                 '((paper     . |#DDEABE|)
                   (paper-2   . |#EEF6CF|)
                   (panel     . |#EEF6CF|)
                   (ink       . |#415915|)
                   (dim       . |#85AC41|)
                   (line      . |#85AC41|)
                   (pill-bg   . |#EEF6CF|)
                   (green     . |#3D8828|)
                   (amber-fg  . |#A88510|)
                   (amber-bg  . |#F0E4A8|)
                   (blue-fg   . |#2868A0|)
                   (blue-bg   . |#C0D8F0|)
                   (rose-fg   . |#C43838|)
                   (rose-bg   . |#F5D0C8|)))
   ;; moonlight: blush paper, lilac ink. EXCEPTION: pill-bg is their
   ;; background-completed — the selected lilac is a mid tone, and a date's
   ;; green on it is 1.4:1.
   (make-palette "moon" #:scheme 'light
                 '((paper     . |#FDF6F6|)
                   (paper-2   . |#ECE7EE|)
                   (panel     . |#DFDEF2|)
                   (ink       . |#615F7F|)
                   (dim       . |#8B6FA8|)
                   (line      . |#E4D8EA|)
                   (pill-bg   . |#EFEEF5|)
                   (green     . |#5FA876|)
                   (amber-fg  . |#C9A84F|)
                   (amber-bg  . |#F9ECC7|)
                   (blue-fg   . |#6B8BC9|)
                   (blue-bg   . |#C9D8F4|)
                   (rose-fg   . |#C85B5B|)
                   (rose-bg   . |#FDCDC8|)))
   ;; neutral near-black, no hue in the grays at all.
   (make-palette "neo" #:scheme 'dark
                 '((paper     . |#141414|)
                   (paper-2   . |#2D2D2D|)
                   (panel     . |#373737|)
                   (ink       . |#DCDBDB|)
                   (dim       . |#9EA1A2|)
                   (line      . |#242424|)
                   (pill-bg   . |#286C8E|)
                   (green     . |#8DBD6A|)
                   (amber-fg  . |#F1C068|)
                   (amber-bg  . |#F1C06899|)
                   (blue-fg   . |#76A9FA|)
                   (blue-bg   . |#76A9FA99|)
                   (rose-fg   . |#CF4653|)
                   (rose-bg   . |#CF465399|)))
   ;; the editor palette, by way of their port of it: blue-gray page, muted
   ;; everything. Its one dim tone is dim on purpose and stays that way.
   (make-palette "one-dark" #:scheme 'dark
                 '((paper     . |#282C33|)
                   (paper-2   . |#2F343E|)
                   (panel     . |#3B4048|)
                   (ink       . |#C8CCD4|)
                   (dim       . |#5D636F|)
                   (line      . |#3B4048|)
                   (pill-bg   . |#293B5B|)
                   (green     . |#A1C181|)
                   (amber-fg  . |#DFC184|)
                   (amber-bg  . |#DFC18499|)
                   (blue-fg   . |#73ADE9|)
                   (blue-bg   . |#73ADE999|)
                   (rose-fg   . |#D07277|)
                   (rose-bg   . |#D0727799|)))
   ;; black steel, orange readout, red frame. THE EXCEPTIONS, all of them
   ;; forced: robot paints its accent BACKGROUNDS the same solid color as its
   ;; accent TEXT (a chip whose label is its own ground), so the three accent
   ;; grounds are the washes it draws behind text instead; dim is its gray
   ;; rather than its red, which is already the frame and the error; and a
   ;; pill's ground is its own near-black rather than the lime selection wash.
   (make-palette "robot" #:scheme 'dark
                 '((paper     . |#000000|)
                   (paper-2   . |#1A2B2B|)
                   (panel     . |#FEA14320|)
                   (ink       . |#FEA143|)
                   (dim       . |#7A8A8A|)
                   (line      . |#E8393F|)
                   (pill-bg   . |#151413|)
                   (green     . |#4ED8A3|)
                   (amber-fg  . |#DFE361|)
                   (amber-bg  . |#FAFF7A26|)
                   (blue-fg   . |#3580D3|)
                   (blue-bg   . |#A9E9F126|)
                   (rose-fg   . |#E8393F|)
                   (rose-bg   . |#E8393F65|)))))

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

;; A palette value is a css-expr hex symbol (`|#FAFAF6|`); a <meta> wants the
;; string. Spelled once so the page, the manifest, and the tests agree.
(define (palette-hex-string v)
  (cond
    [(symbol? v) (symbol->string v)]
    [(string? v) v]
    [else (error 'theme "palette value is not a colour: ~e" v)]))

(define theme-default-paper
  (palette-hex-string (cdr (assq 'paper (theme-entries theme-default)))))

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
   #:--panel-w (apply max 21rem 33vw)
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
  ;; a phone that auto-zooms text on landscape is fighting the layout; keep
  ;; type at the size we set. touch-action kills the 300ms double-tap wait
  [html #:-webkit-text-size-adjust 100%
        #:text-size-adjust 100%
        #:touch-action manipulation
        #:-webkit-tap-highlight-color transparent]))

;; The page IS the layout: sidebar and main pane are its two flex children.
;; On a phone there is no room for two columns, so the same two stack — the
;; only rule about the document as a whole, and it lives with the document.
;;
;; 100dvh tracks the visible viewport on mobile browsers whose chrome grows
;; and shrinks; 100vh is the fallback where dvh is unknown. safe-area insets
;; are for notched phones (viewport-fit=cover is on the page).
(define-style ol-body #:tag body #:layer 'base
  #:margin 0
  ;; dvh tracks the visible viewport as mobile browser chrome grows/shrinks;
  ;; fixed panels use the same unit so they do not leave a gap under it
  #:min-height 100dvh
  #:display flex
  #:align-items stretch
  #:background ,paper
  #:color ,ink
  #:font-family ,sans
  #:font-size 15px
  #:line-height 1.5
  ;; notched phones: viewport-fit=cover is on the page, so the insets are real
  #:padding-top (apply env safe-area-inset-top)
  #:padding-left (apply env safe-area-inset-left)
  #:padding-right (apply env safe-area-inset-right)
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
