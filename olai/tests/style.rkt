#lang racket/base

;; Tests for the CSS-as-code mechanism. No server, no files: a stylesheet is a
;; string, and these read it.
;;
;; The fixtures below are module level ON PURPOSE — they register into the same
;; global registry theme.rkt does, and after it, which is what the ordering
;; test reads. Instantiation order is the cascade; that is the contract.

(require rackunit
         racket/file
         racket/list
         racket/set
         racket/string
         olai/web/style
         ;; the whole skin, in cascade order — the parity and border tests
         ;; below read the sheet it composes
         olai/web/skin
         ;; two classes the assertions below name
         (only-in olai/web/theme sf-body)
         (only-in olai/web/render web-static-dir))

;; ---- fixtures -------------------------------------------------------------

(define-modifier is-probe)

(define-style sf-probe-box
  #:color red
  ;; a nested rule reaching the same class's hover state
  [(: & hover) #:color blue])

(define-component (probe-badge-xexpr text)
  #:class sf-probe-badge
  #:css (#:display inline-flex
         #:border-radius 9999px)
  `(span ((class ,sf-probe-badge)) ,text))

;; The escape hatch, exercised: a raw string goes out verbatim. (Nothing here
;; NEEDS one — css-expr spells everything app.css does — but the mechanism
;; promises it, so the promise is tested.)
(define probe-raw "/* probe */ .probe-raw { color: red }")
(register-fragment! probe-raw)

(define (index-of-substring haystack needle)
  (define m (regexp-match-positions (regexp (regexp-quote needle)) haystack))
  (and m (caar m)))

;; ---- the skin's border ----------------------------------------------------

;; Every class the hand-written web/static/app.css styled, frozen. app.css is
;; gone; this list is what says so out loud when a class stops being defined.
;; A class LEAVES the skin by leaving this list, deliberately — not by a
;; selector quietly matching nothing.
(define app-css-classes
  '("has-children" "has-commands" "is-agent" "is-busy" "is-collapsed" "is-done"
    "is-error" "is-open" "is-picked" "is-today" "is-tree" "is-user"
    "sf-anchor" "sf-banner-slot" "sf-body" "sf-brand" "sf-brand-link"
    "sf-breadcrumbs" "sf-bullet" "sf-bullet-link" "sf-chat" "sf-chat-actions"
    "sf-chat-body" "sf-chat-btn" "sf-chat-cmd" "sf-chat-cmd-desc"
    "sf-chat-cmd-name" "sf-chat-cmds" "sf-chat-dock" "sf-chat-form"
    "sf-chat-head" "sf-chat-input" "sf-chat-model" "sf-chat-msg" "sf-chat-note"
    "sf-chat-open" "sf-chat-pop" "sf-chat-send" "sf-chat-sep" "sf-chat-session"
    "sf-chat-spop" "sf-chat-stop" "sf-chat-title" "sf-chat-tool"
    "sf-chat-tool-glyph" "sf-chat-tool-title" "sf-chat-turn" "sf-chat-working"
    "sf-check" "sf-children" "sf-code" "sf-content" "sf-crumb" "sf-crumb-sep"
    "sf-date" "sf-date-time" "sf-day" "sf-dim" "sf-empty" "sf-error"
    "sf-error-detail" "sf-error-where" "sf-file" "sf-file-title" "sf-line"
    "sf-link" "sf-main" "sf-mirror" "sf-nav-icon" "sf-nav-item" "sf-node"
    "sf-note" "sf-outline" "sf-pill" "sf-pre" "sf-row" "sf-sidebar"
    "sf-sidebar-empty" "sf-sidebar-heading" "sf-sidebar-nav"
    "sf-sidebar-section" "sf-tag" "sf-title" "sf-toggle" "sf-toggle-empty"
    "sf-tree" "sf-tree-file" "sf-tree-file-label" "sf-tree-link"))

;; Class-shaped names in a .js file: the same three prefixes the skin uses,
;; wherever they appear (a class list, a selector, an id that doubles as one).
(define class-rx #px"(?:^|[^a-zA-Z0-9_-])((?:sf|is|has)-[a-z0-9]+(?:-[a-z0-9]+)*)")

(define (js-class-names path)
  (remove-duplicates
   (regexp-match* class-rx (file->string path) #:match-select cadr)))

;; A name a script uses and nothing styles. Empty, and meant to stay that way:
;; an entry here is a promise that the class is a hook with no look.
(define styleless-js-classes '())

(module+ test

  ;; ---- identifiers become class names -------------------------------------

  (test-case "define-style binds the class-name string, hyphens kept"
    (check-equal? sf-probe-box "sf-probe-box"))

  (test-case "define-modifier binds the string and registers no rule"
    (check-equal? is-probe "is-probe")
    (check-false (index-of-substring (stylesheet) ".is-probe{")))

  (test-case "define-component binds its class and defines a render function"
    (check-equal? sf-probe-badge "sf-probe-badge")
    (check-equal? (probe-badge-xexpr "hi") '(span ((class "sf-probe-badge")) "hi"))
    (check-true (string-contains? (stylesheet) ".sf-probe-badge{display:inline-flex;")))

  ;; ---- selectors ----------------------------------------------------------

  (test-case "sel compounds bound class names"
    (check-equal? (fragment->css (css-expr [,(sel sf-probe-box is-probe) #:color red]))
                  ".sf-probe-box.is-probe{color:red;}"))

  (test-case "sel takes a leading tag"
    (check-equal? (fragment->css (css-expr [,(sel 'body sf-probe-box) #:margin 0]))
                  "body.sf-probe-box{margin:0;}"))

  (test-case "sel refuses a tag after a class"
    (check-exn exn:fail? (lambda () (sel sf-probe-box 'body))))

  ;; The selector the collapsed-parent halo needs: compound, child, descendant
  ;; and a pseudo-element in one breath.
  (test-case "sel composes with every css-expr combinator"
    (check-equal?
     (fragment->css
      (css-expr [(> ,(sel "sf-node" "is-collapsed")
                    (,(sel "sf-row") (:: ,(sel "sf-bullet" "has-children") before)))
                 #:content ""]))
     ".sf-node.is-collapsed>.sf-row .sf-bullet.has-children::before{content:\"\";}"))

  ;; ---- fragments ----------------------------------------------------------

  (test-case "a css-expr fragment compiles; a nested & rule unnests"
    (define css (fragment->css (css-expr [(\. sf-probe-box) #:color red
                                          [(: & hover) #:color blue]])))
    (check-equal? css ".sf-probe-box{color:red;}.sf-probe-box:hover{color:blue;}"))

  (test-case "a raw-string fragment passes through verbatim"
    (check-equal? (fragment->css probe-raw) probe-raw)
    (check-true (string-contains? (stylesheet) probe-raw)))

  ;; ---- the registry -------------------------------------------------------

  (test-case "require order is cascade order: theme first, then this module"
    (define css (stylesheet))
    (define theme-at (index-of-substring css "--l-paper:"))
    (define probe-at (index-of-substring css ".sf-probe-box{"))
    (check-not-false theme-at css)
    (check-not-false probe-at css)
    (check-true (< theme-at probe-at)))

  (test-case "within a module, definition order is preserved"
    (define css (stylesheet))
    (define box-at (index-of-substring css ".sf-probe-box{"))
    (define badge-at (index-of-substring css ".sf-probe-badge{"))
    (define raw-at (index-of-substring css probe-raw))
    (check-not-false box-at css)
    (check-not-false badge-at css)
    (check-not-false raw-at css)
    (check-true (< box-at badge-at))
    (check-true (< badge-at raw-at)))

  ;; ---- theme --------------------------------------------------------------

  (test-case "both palettes are in the sheet, spelled once each"
    (define css (stylesheet))
    (check-true (string-contains? css "--l-paper:#E4ECCA;") css)
    (check-true (string-contains? css "--l-rose-bg:#F5DBDF;") css)
    (check-true (string-contains? css "--d-paper:#1E2417;") css)
    (check-true (string-contains? css "--d-rose-bg:#402028;") css))

  (test-case "light is the default mapping and data-theme overrides either way"
    (define css (stylesheet))
    (check-true (string-contains? css ":root,:root[data-theme=\"light\"]{--paper:var(--l-paper);")
                css)
    (check-true (string-contains? css ":root[data-theme=\"dark\"]{--paper:var(--d-paper);") css)
    (check-true (string-contains? css "@media (prefers-color-scheme:dark){:root{--paper:var(--d-paper);")
                css))

  (test-case "the mapping covers every token in both directions"
    (define css (stylesheet))
    (for ([token (in-list '("paper" "paper-2" "panel" "ink" "dim" "line" "pill-bg" "green"
                            "amber-fg" "amber-bg" "blue-fg" "blue-bg" "rose-fg" "rose-bg"))])
      (check-true (string-contains? css (string-append "--" token ":var(--l-" token ");")) token)
      (check-true (string-contains? css (string-append "--" token ":var(--d-" token ");")) token)))

  (test-case "fonts and layout vars"
    (define css (stylesheet))
    (check-true (string-contains? css "--sans:ui-sans-serif,system-ui,-apple-system,\"Segoe UI\"")
                css)
    (check-true (string-contains? css "--mono:ui-monospace,SFMono-Regular,\"SF Mono\"") css)
    (check-true (string-contains? css "--sidebar-w:15rem;") css)
    (check-true (string-contains? css "--chat-w:max(21rem,33vw);") css)
    (check-true (string-contains? css "--indent:1.375rem;") css)
    (check-true (string-contains? css "--radius:0.375rem;") css))

  (test-case "base rules: reset, html, body, links, focus ring"
    (define css (stylesheet))
    (check-true (string-contains? css "*,*::before,*::after{box-sizing:border-box;}") css)
    (check-true (string-contains? css "html{-webkit-text-size-adjust:100%;}") css)
    (check-equal? sf-body "sf-body")
    (check-true (string-contains? css "body.sf-body{margin:0;min-height:100vh;display:flex;") css)
    (check-true (string-contains? css "background:var(--paper);color:var(--ink);") css)
    (check-true (string-contains? css "a{color:inherit;}") css)
    (check-true (string-contains? css ":focus-visible{outline:2px solid var(--green);outline-offset:2px;}")
                css))

  ;; ---- the border with app.css ------------------------------------------

  (test-case "every class the old stylesheet styled is still defined"
    (define known (list->seteq (map string->symbol (class-names))))
    (for ([c (in-list app-css-classes)])
      (check-true (set-member? known (string->symbol c))
                  (format "~a is in no module's define-style/-component/-modifier" c))))

  (test-case "every class the old stylesheet styled still has a selector"
    (define css (stylesheet))
    (for ([c (in-list app-css-classes)])
      (check-true (string-contains? css (string-append "." c))
                  (format "no .~a selector in the generated sheet" c))))

  ;; ---- the border with the scripts --------------------------------------

  ;; The compiler checks the two Racket sides of a class name. Nothing checks
  ;; the third, so this does: a class chat.js toggles and no module defines is
  ;; a selector that matches nothing, discovered in a browser at 3am.
  (test-case "every class the scripts spell is a class the skin defines"
    (define known (list->seteq (map string->symbol (class-names))))
    (define allowed (list->seteq (map string->symbol styleless-js-classes)))
    (for ([js (in-list (list "chat.js" "collapse.js" "sse.js"))])
      (define path (build-path (web-static-dir) js))
      (for ([c (in-list (js-class-names path))])
        (define sym (string->symbol c))
        (check-true (or (set-member? known sym) (set-member? allowed sym))
                    (format "~a spells .~a; no module defines it" js c)))))

  ;; ---- the cascade, where a rule leans on it ----------------------------

  ;; Equal-specificity pairs: the second one only wins because it is second.
  ;; These are the places a require moved to the wrong line would break.
  (test-case "order-sensitive rules land in the order they need"
    (define css (stylesheet))
    (define (at s)
      (define i (index-of-substring css s))
      (check-not-false i (format "missing: ~a" s))
      i)
    (for ([pair (in-list
                 (list
                  ;; the pill's shape, then each kind's paint
                  (list ".sf-pill{" ".sf-date{")
                  (list ".sf-pill{" ".sf-tag{")
                  ;; the popover, then the same popover at the other end
                  (list ".sf-chat-pop{" ".sf-chat-spop{")
                  ;; the three buttons' shared block, then the stop's alarm
                  (list ".sf-chat-btn,.sf-chat-send,.sf-chat-stop{" ".sf-chat-stop{color")
                  ;; having commands shows the button; being busy hides it again
                  (list ".sf-chat.has-commands .sf-chat-cmds" ".sf-chat.is-busy .sf-chat-cmds")
                  ;; the outline's skin, then the panel that overlays it
                  (list ".sf-main{" "body.sf-body:has")))])
      (check-true (< (at (first pair)) (at (second pair)))
                  (format "~a must come before ~a" (first pair) (second pair))))))
