#lang racket/base

;; Tests for the CSS-as-code mechanism, and for the three borders the skin has
;; that the compiler cannot check: the class LIST (a golden file), the SCRIPTS
;; that spell class names the Racket side never writes, and the MARKUP that has
;; to wear every class some module paints.
;;
;; What this file asks, and what it does not: ordering questions are asked of
;; the REGISTRY (style-fragments, fragment-classes) and theme questions are
;; generated from theme.rkt's own token list. css-expr's output text is pinned
;; in exactly one test case, marked as the canary. A css-expr bump is allowed
;; to break that case and nothing else here.
;;
;; (This suite grew out of the app.css port — every class the hand-written
;; stylesheet styled had to still be defined and still have a selector. The
;; parity claim was true at e710597 and is history now; what stands in its
;; place is classes.golden, which is regenerated rather than hand-edited.)
;;
;; The fixtures below are module level ON PURPOSE — they register into the same
;; global registry theme.rkt does, and after it, which is what the ordering
;; tests read. Instantiation order is the cascade; that is the contract.

(require rackunit
         json
         racket/file
         racket/list
         racket/runtime-path
         racket/set
         racket/string
         syntax/macro-testing
         olai/web/style
         ;; the whole skin, in cascade order — every border test below reads
         ;; what it composes
         olai/web/skin
         ;; the skin's own vocabulary: the two classes named below, the token
         ;; lists the theme tests fold over, and where a theme writes a value
         (only-in olai/web/theme
                  ol-body ol-pill theme-names palette-tokens layout-tokens
                  theme-token-property)
         ;; the renderers: what the skin is FOR, and the only honest answer to
         ;; "does anything wear this class"
         olai/web/render
         olai/web/chat-panel
         olai/store
         (only-in olai/lang/walk resolve-mirrors)
         (except-in olai/lang/expander #%module-begin))

;; The skin's classes, captured BEFORE this module's fixtures register: a
;; module body runs in order, so this is every class olai/web/skin defines and
;; nothing of the probes below.
(define skin-classes (class-names))

(define-runtime-path classes-golden "classes.golden")
;; demo fiction, never personal data (CLAUDE.md): the outlines CI draws pages
;; from
(define-runtime-path examples-dir "../../examples")

;; ---- fixtures -------------------------------------------------------------

(define-modifier is-probe)

(define-style ol-probe-box
  #:color red
  ;; a nested rule reaching the same class's hover state
  [(: & hover) #:color blue])

(define-component (probe-badge-xexpr text)
  #:class ol-probe-badge
  #:css (#:display inline-flex
         #:border-radius 9999px)
  `(span ((class ,ol-probe-badge)) ,text))

;; The escape hatch, exercised: a raw string goes out verbatim. (Nothing here
;; NEEDS one — css-expr spells everything app.css did — but the mechanism
;; promises it, so the promise is tested.)
(define probe-raw "/* probe */ .probe-raw { color: red }")
(register-fragment! probe-raw)

;; ---- reading the registry -------------------------------------------------
;;
;; The sheet as a LIST, read once: every fragment in the order it comes out,
;; and the layer that put it there. "Does this rule land before that one" is a
;; question about these positions; asking the minified text instead is asking
;; css-expr's serializer a question about olai.

(define ordered-fragments (style-fragments))

(define (fragment-layer i) (car (list-ref ordered-fragments i)))

;; every position a class's own rules land at, in cascade order
(define (class-positions name)
  (for/list ([f (in-list ordered-fragments)]
             [i (in-naturals)]
             #:when (member name (fragment-classes (cdr f))))
    i))

;; where a raw fragment landed — it names no class, so it is found by identity
(define (fragment-position fragment)
  (index-of (map cdr ordered-fragments) fragment))

;; every class some rule in the sheet names
(define styled-classes
  (remove-duplicates
   (append* (for/list ([f (in-list ordered-fragments)]) (fragment-classes (cdr f))))))

;; ---- reading the markup ---------------------------------------------------

(define (attribute-list? v)
  (and (list? v)
       (andmap (λ (a) (and (pair? a) (symbol? (car a)) (pair? (cdr a)) (string? (cadr a))))
               v)))

;; Every class token a rendered xexpr wears, split the way a browser splits a
;; class attribute.
(define (xexpr-classes x)
  (let walk ([x x] [acc (set)])
    (cond
      [(and (pair? x) (symbol? (car x)))
       (define rest (cdr x))
       (define attrs (if (and (pair? rest) (attribute-list? (car rest))) (car rest) '()))
       (define kids (if (null? attrs) rest (cdr rest)))
       (for/fold ([acc (for/fold ([acc acc])
                                 ([a (in-list attrs)] #:when (eq? (car a) 'class))
                         (set-union acc (list->set (string-split (cadr a)))))])
                 ([k (in-list kids)])
         (walk k acc))]
      [(list? x) (for/fold ([acc acc]) ([k (in-list x)]) (walk k acc))]
      [else acc])))

;; The pages the renderers can draw, from the demo outlines: the outline pane
;; with a sidebar and a banner, a zoom, an empty pane, a mirror site that names
;; nothing, and the chat panel mid-turn. Between them they draw every state the
;; skin paints — which is what makes "nothing wears this class" mean something.
(define example-today "2026-08-03")

(define example-snapshot
  (store-snapshot
   (make-store (list (build-path examples-dir "Example.rkt")
                     (build-path examples-dir "Daily.rkt")))))

(define example-files (snapshot-files-data example-snapshot))

(define (example-pages)
  (list
   (render-page (render-outline example-files
                                #:today example-today
                                #:zoom-base "/z/" #:toggle-base "/toggle/")
                #:sidebar (render-sidebar example-files
                                          #:home-href "/" #:today-href "/today"
                                          #:zoom-base "/z/")
                #:banner (render-error-banner "expected ISO date"
                                              #:where "/tmp/Tasks.rkt:3:4"))
   (render-zoom (snapshot-index example-snapshot) "agent"
                #:today example-today #:home-href "/" #:zoom-base "/z/")
   (render-empty-pane "No such node." #:home-href "/")
   ;; a mirror site whose anchor named nothing: the outline still says
   ;; something belongs here, and the marker is drawn in that state
   (render-node-fragment
    (car (resolve-mirrors
          (list (make-task #:title "Holder" #:key "probe-holder"
                           #:children (list (mirror-ref "no-such-anchor" #f))))
          (hash)))
    #:today example-today)
   (render-chat-panel
    (list (hash 'type "turn"
                'text "run it"
                'agent "a **note**, `code`, [a link](https://example.com)\n\n```\nblock\n```\n"
                'tools (list (hash 'id "call-1" 'title "read Tasks.rkt" 'status "completed"))
                'status "done" 'stopReason "cancelled" 'error "the agent exited (code 1)")
          (hash 'type "reset" 'message (json-null)))
    #:busy? #t
    #:send-href "/chat" #:new-href "/chat/new" #:cancel-href "/chat/cancel"
    #:sessions-href "/chat/sessions" #:load-href "/chat/load"
    #:event "chat" #:model "fake-model-1" #:session-title "the last conversation"
    #:commands (list (hash 'name "fake-init" 'description "start something")))))

(define rendered-classes
  (for/fold ([acc (set)]) ([page (in-list (example-pages))])
    (set-union acc (xexpr-classes page))))

;; ---- reading the scripts --------------------------------------------------

;; Class-shaped names in a .js file: the same three prefixes the skin uses,
;; wherever a script spells one (a class list, a selector, a closest()).
(define class-rx #px"(?:^|[^a-zA-Z0-9_-])((?:ol|is|has)-[a-z0-9]+(?:-[a-z0-9]+)*)")

;; getElementById's argument is an ID, not a class. Several elements here are
;; both — addressed by id, painted by a class of the same name — and reading
;; the id as a class would make this border demand a rule for every id a script
;; looks up. Blanked out before the scan; every other context (classList,
;; className, querySelector, closest, a selector string) stays in it.
(define (strip-element-ids src)
  (regexp-replace* #px"getElementById\\((['\"])[^'\"]*" src "getElementById("))

(define (js-class-names path)
  (remove-duplicates
   (regexp-match* class-rx (strip-element-ids (file->string path)) #:match-select cadr)))

;; olai's own scripts plus the vendored sse extension. htmx itself is not in
;; the list: it spells no olai class, and scanning a minified bundle for
;; class-shaped names would find noise, not a border.
(define script-names '("chat.js" "collapse.js" "prefs.js" "sse.js"))

(define scripted-classes
  (for/fold ([acc (set)]) ([js (in-list script-names)])
    (set-union acc (list->set (js-class-names (build-path (web-static-dir) js))))))

;; ---- the named exceptions -------------------------------------------------

;; A class the skin BINDS but paints nothing. Each entry is a promise that
;; there is nothing to look at: a state read by a script, or a hook something
;; addresses.
(define styleless-classes
  '("ol-pane"        ; the outline pane's own class; the SSE swap target is its id
    "ol-zoom"        ; marks a pane as zoomed — the crumbs above it are the difference
    "ol-zoom-root"   ; the zoomed subtree's root list; .ol-outline is what paints it
    "ol-unresolved"  ; a mirror site naming nothing; the marker inside says so
    "ol-crumb-home"  ; the first crumb, drawn like any other crumb
    "ol-chat-sink")) ; where SSE frames land, hidden: nothing to see by design

;; A name a script uses and nothing styles. Empty, and meant to stay that way:
;; an entry here is a promise that the class is a hook with no look.
(define styleless-js-classes '())

;; A class no rendered page wears and no script spells: a rule for markup that
;; does not exist. Empty, and meant to stay that way — an entry here is a
;; promise that something draws it somewhere this suite cannot reach.
(define unworn-classes '())

(module+ test

  ;; ---- identifiers become class names -------------------------------------

  (test-case "define-style binds the class-name string, hyphens kept"
    (check-equal? ol-probe-box "ol-probe-box")
    ;; one define-style, one fragment, and the class is what it is about
    (check-equal? (length (class-positions ol-probe-box)) 1))

  (test-case "define-modifier binds the string and registers no rule"
    (check-equal? is-probe "is-probe")
    (check-equal? (class-positions is-probe) '()))

  (test-case "define-component binds its class and defines a render function"
    (check-equal? ol-probe-badge "ol-probe-badge")
    (check-equal? (probe-badge-xexpr "hi") '(span ((class "ol-probe-badge")) "hi"))
    (check-equal? (length (class-positions ol-probe-badge)) 1))

  (test-case "sel refuses a tag after a class"
    (check-exn exn:fail? (lambda () (sel ol-probe-box 'body))))

  ;; ---- the canary ---------------------------------------------------------

  ;; The ONE place this suite pins css-expr's output TEXT: compound selectors,
  ;; a leading tag, every combinator in one breath, and a nested & unnesting.
  ;; A css-expr bump is allowed to break this test case and no other here —
  ;; when it does, read the new output and decide whether it is still the CSS
  ;; we meant, then fix this case. If anything ELSE in this file breaks with
  ;; it, that is the bug report.
  (test-case "canary: css-expr still serializes the way we think"
    (check-equal? (fragment->css (css-expr [,(sel ol-probe-box is-probe) #:color red]))
                  ".ol-probe-box.is-probe{color:red;}")
    (check-equal? (fragment->css (css-expr [,(sel 'body ol-probe-box) #:margin 0]))
                  "body.ol-probe-box{margin:0;}")
    (check-equal?
     (fragment->css
      (css-expr [(> ,(sel "ol-node" "is-collapsed")
                    (,(sel "ol-row") (:: ,(sel "ol-bullet" "has-children") before)))
                 #:content ""]))
     ".ol-node.is-collapsed>.ol-row .ol-bullet.has-children::before{content:\"\";}")
    (check-equal?
     (fragment->css (css-expr [(\. ol-probe-box) #:color red [(: & hover) #:color blue]]))
     ".ol-probe-box{color:red;}.ol-probe-box:hover{color:blue;}"))

  ;; ---- fragments ----------------------------------------------------------

  (test-case "a raw-string fragment passes through verbatim"
    (check-equal? (fragment->css probe-raw) probe-raw)
    (check-true (string-contains? (stylesheet) probe-raw)))

  ;; ---- the registry -------------------------------------------------------

  (define (at name)
    (define ps (class-positions name))
    (check-true (pair? ps) (format "no rule in the sheet names .~a" name))
    (car ps))

  (test-case "the sheet comes out layer by layer"
    (define ranks
      (for/list ([f (in-list ordered-fragments)]) (index-of css-layers (car f))))
    (check-equal? ranks (sort ranks <) "a fragment came out ahead of its layer"))

  (test-case "require order is cascade order: the skin, then this module"
    ;; across layers: the document's own rules are first
    (check-true (< (at ol-body) (at ol-probe-box)))
    ;; and inside one layer, whoever was instantiated first
    (check-equal? (fragment-layer (at "ol-node")) 'component)
    (check-equal? (fragment-layer (at ol-probe-box)) 'component)
    (check-true (< (at "ol-node") (at ol-probe-box))))

  (test-case "within a module, definition order is preserved"
    (check-true (< (at ol-probe-box) (at ol-probe-badge)))
    (check-not-false (fragment-position probe-raw))
    (check-true (< (at ol-probe-badge) (fragment-position probe-raw))))

  ;; ---- the cascade, where a rule leans on it ------------------------------

  ;; Equal-specificity pairs: the second one only wins because it is second.
  ;; These are the places a require moved to the wrong line would break. Class
  ;; names that no module provides are spelled as strings — a rename makes them
  ;; a rule that names nothing, which is what `at` reports.
  (test-case "order-sensitive rules land in the order they need"
    ;; the pill's shape, then each kind's paint
    (check-true (< (at ol-pill) (at "ol-date")) "the pill's shape comes before the date's paint")
    (check-true (< (at ol-pill) (at "ol-tag")) "the pill's shape comes before the tag's paint")
    ;; the popover, then the same popover at the other end
    (check-true (< (at "ol-chat-pop") (at "ol-chat-spop"))
                "the sessions popover repaints .ol-chat-pop and must follow it")
    ;; the three buttons' shared block is the FIRST thing the sheet says about
    ;; the stop; the stop's alarm color repaints it after
    (check-equal? (at "ol-chat-stop") (at "ol-chat-btn")
                  "the buttons' shared block is not the stop's first rule")
    (check-true (> (length (class-positions "ol-chat-stop")) 1))
    ;; having commands shows the button, being busy hides it again: ONE
    ;; fragment, so the two rules are in source order and no require can get
    ;; between them (that they stay in source order is the canary's business)
    (check-equal? (length (class-positions "ol-chat-cmds")) 1
                  "the commands button's rules are no longer one fragment")
    ;; the outline's skin, then the panel that overlays it — this pair is a
    ;; LAYER apart, which is the rule saying out loud what it leans on
    (check-equal? (fragment-layer (at ol-main)) 'component)
    (check-equal? (fragment-layer (last (class-positions ol-main))) 'overlay)
    (check-true (< (at ol-main) (last (class-positions ol-main)))))

  ;; ---- theme --------------------------------------------------------------

  ;; A custom property, DECLARED: the name and whatever whitespace the
  ;; serializer does or does not put around the colon.
  (define (declares? css property)
    (regexp-match? (regexp (string-append (regexp-quote property) "\\s*:")) css))

  ;; the skin's name for a token, pointed at one theme's value
  (define (maps? css token property)
    (regexp-match?
     (regexp (string-append (regexp-quote (string-append "--" (symbol->string token)))
                            "\\s*:\\s*var\\(\\s*" (regexp-quote property) "\\s*\\)"))
     css))

  ;; The block that puts ONE theme in force: found by the selector a page uses
  ;; to ask for it, read as CSS. Scoping the mapping checks to it is what makes
  ;; them a question about that theme rather than about the sheet — with five
  ;; themes, "something somewhere maps --paper" is true no matter which one is
  ;; broken.
  (define (theme-block theme)
    (define rx (regexp (string-append "data-theme\\s*=\\s*\"" theme "\"")))
    (for/first ([f (in-list ordered-fragments)]
                #:when (regexp-match? rx (fragment->css (cdr f))))
      (fragment->css (cdr f))))

  ;; Generated from theme.rkt's own table: the tokens are its list and the
  ;; property names are its spelling. A token added to the skin is checked in
  ;; every theme the moment it is added, and a theme that forgets one fails
  ;; here rather than resolving to nothing in a browser. Adding a THEME is the
  ;; same: it is checked the moment it joins the table.
  (test-case "every theme declares every token, and its own block maps them all"
    (define css (stylesheet))
    (check-true (pair? theme-names))
    (check-true (pair? palette-tokens))
    (for ([theme (in-list theme-names)])
      (define block (or (theme-block theme) ""))
      (check-true (non-empty-string? block)
                  (format "no page can ask for the ~a theme" theme))
      (for ([token (in-list palette-tokens)])
        (define property (theme-token-property theme token))
        (check-true (declares? css property)
                    (format "the ~a theme declares no ~a" theme property))
        (check-true (maps? block token property)
                    (format "the ~a theme's block does not point --~a at ~a"
                            theme token property)))))

  ;; The browser paints the scrollbars, the form controls and the canvas, and
  ;; color-scheme is the only thing that tells it which way. A theme that put
  ;; its colors in force and not this would read dark under light chrome.
  (test-case "every theme says which color-scheme it is"
    (for ([theme (in-list theme-names)])
      (check-true (regexp-match? #px"[^-]color-scheme\\s*:\\s*(light|dark)"
                                 (or (theme-block theme) ""))
                  (format "the ~a theme does not say which color-scheme it is"
                          theme))))

  (test-case "the layout vocabulary is declared, and does not vary by theme"
    (define css (stylesheet))
    (check-true (pair? layout-tokens))
    (for ([token (in-list layout-tokens)])
      (define property (string-append "--" (symbol->string token)))
      (check-true (declares? css property) (format "nothing declares ~a" property))))

  (test-case "a page can name a theme, and the OS's preference is read"
    (define css (stylesheet))
    (check-true (regexp-match? #px"prefers-color-scheme\\s*:\\s*dark" css)
                "no rule reads the OS's preference")
    (for ([theme (in-list theme-names)])
      (check-true (regexp-match? (regexp (string-append "data-theme\\s*=\\s*\"" theme "\"")) css)
                  (format "no page can ask for the ~a theme" theme))))

  ;; Two values, spelled out: the table in theme.rkt is the source, and this is
  ;; the spot check that says it reaches the sheet verbatim rather than through
  ;; some normalization. Same standing as the canary above.
  (test-case "canary: palette values reach the sheet verbatim (spot check)"
    (define css (stylesheet))
    (check-true (string-contains? css "#E4ECCA") "light --paper")
    (check-true (string-contains? css "#402028") "dark --rose-bg"))

  ;; ---- the class list -----------------------------------------------------

  ;; The list is GENERATED: `just css-classes` rewrites classes.golden from the
  ;; skin. A rename shows up here as one line gone and one line added, in a
  ;; diff, and is accepted by running that recipe — not by editing a literal.
  (define golden-classes
    (filter (λ (s) (not (string=? s "")))
            (string-split (file->string classes-golden) "\n")))

  (test-case "every class the skin defines is in classes.golden"
    (check-equal? (remove* golden-classes skin-classes) '()
                  "classes new to the skin; run `just css-classes` to accept them"))

  (test-case "every class classes.golden lists is still defined"
    (check-equal? (remove* skin-classes golden-classes) '()
                  "classes gone from the skin; run `just css-classes` to accept that"))

  (test-case "classes.golden is what the recipe writes: sorted, one per line"
    (check-equal? golden-classes (sort golden-classes string<?)
                  "classes.golden is out of order; run `just css-classes`")
    (check-equal? (length golden-classes) (length (remove-duplicates golden-classes))
                  "classes.golden lists a class twice; run `just css-classes`"))

  (test-case "every class the skin defines either has a rule or is a named hook"
    (for ([c (in-list skin-classes)])
      (check-true (or (and (member c styled-classes) #t)
                      (and (member c styleless-classes) #t))
                  (format "~a is bound, but no rule in the sheet names .~a" c c))))

  ;; ---- the border with the scripts ----------------------------------------

  ;; The compiler checks the two Racket sides of a class name. Nothing checks
  ;; the third, so this does: a class chat.js toggles and no module defines is
  ;; a selector that matches nothing, discovered in a browser at 3am.
  (test-case "every class the scripts spell is a class the skin defines"
    (define known (list->set skin-classes))
    (define allowed (list->set styleless-js-classes))
    (for ([js (in-list script-names)])
      (for ([c (in-list (js-class-names (build-path (web-static-dir) js)))])
        (check-true (or (set-member? known c) (set-member? allowed c))
                    (format "~a spells .~a; no module defines it" js c)))))

  ;; ---- the border the other way -------------------------------------------

  ;; The reverse question, and the one a hand-written stylesheet never gets
  ;; asked: is there a rule here for markup nobody draws? Every class the skin
  ;; defines has to turn up in a page the renderers can draw, or in a script
  ;; that builds one.
  (test-case "every class the skin defines is worn by markup or spelled by a script"
    (define worn (set-union rendered-classes scripted-classes))
    (define allowed (list->set unworn-classes))
    (check-true (> (set-count rendered-classes) 50)
                "the example pages drew almost nothing; the fixtures are broken")
    (for ([c (in-list skin-classes)])
      (check-true (or (set-member? worn c) (set-member? allowed c))
                  (format "nothing draws .~a: no rendered page wears it, no script spells it"
                          c))))

  ;; ---- the macros' guards -------------------------------------------------

  ;; Two rules the macros enforce, both of them about a name. They are worth a
  ;; test because everything else in this file leans on them: the prefixes are
  ;; how the .js scan finds a class at all, and one owner per class is what
  ;; makes the registry's order the cascade.
  (test-case "a class has one owner: registering a name twice raises"
    (check-exn #px"defined twice"
               (λ () (let () (define-style ol-probe-box #:color red) (void)))))

  (test-case "a name outside ol-/is-/has- is rejected at compile time"
    (check-exn #px"starts with ol-, is- or has-"
               (λ () (convert-compile-time-error
                      (let () (define-style probe-box #:color red) (void)))))
    (check-exn #px"starts with ol-, is- or has-"
               (λ () (convert-compile-time-error
                      (let () (define-modifier probe-state) (void)))))))
