#lang racket/base

;; Tests for the CSS-as-code mechanism. No server, no files: a stylesheet is a
;; string, and these read it.
;;
;; The fixtures below are module level ON PURPOSE — they register into the same
;; global registry theme.rkt does, and after it, which is what the ordering
;; test reads. Instantiation order is the cascade; that is the contract.

(require rackunit
         racket/string
         olai/web/style
         olai/web/theme)

;; ---- fixtures -------------------------------------------------------------

(define-modifier is-probe)

(define-style probe-box
  #:color red
  ;; a nested rule reaching the same class's hover state
  [(: & hover) #:color blue])

(define-component (probe-badge-xexpr text)
  #:class probe-badge
  #:css (#:display inline-flex
         #:border-radius 9999px)
  `(span ((class ,probe-badge)) ,text))

;; The escape hatch, exercised: a raw string goes out verbatim. (Nothing here
;; NEEDS one — css-expr spells everything app.css does — but the mechanism
;; promises it, so the promise is tested.)
(define probe-raw "/* probe */ .probe-raw { color: red }")
(register-fragment! probe-raw)

(define (index-of-substring haystack needle)
  (define m (regexp-match-positions (regexp (regexp-quote needle)) haystack))
  (and m (caar m)))

(module+ test

  ;; ---- identifiers become class names -------------------------------------

  (test-case "define-style binds the class-name string, hyphens kept"
    (check-equal? probe-box "probe-box"))

  (test-case "define-modifier binds the string and registers no rule"
    (check-equal? is-probe "is-probe")
    (check-false (index-of-substring (stylesheet) ".is-probe{")))

  (test-case "define-component binds its class and defines a render function"
    (check-equal? probe-badge "probe-badge")
    (check-equal? (probe-badge-xexpr "hi") '(span ((class "probe-badge")) "hi"))
    (check-true (string-contains? (stylesheet) ".probe-badge{display:inline-flex;")))

  ;; ---- selectors ----------------------------------------------------------

  (test-case "sel compounds bound class names"
    (check-equal? (fragment->css (css-expr [,(sel probe-box is-probe) #:color red]))
                  ".probe-box.is-probe{color:red;}"))

  (test-case "sel takes a leading tag"
    (check-equal? (fragment->css (css-expr [,(sel 'body probe-box) #:margin 0]))
                  "body.probe-box{margin:0;}"))

  (test-case "sel refuses a tag after a class"
    (check-exn exn:fail? (lambda () (sel probe-box 'body))))

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
    (define css (fragment->css (css-expr [(\. probe-box) #:color red
                                          [(: & hover) #:color blue]])))
    (check-equal? css ".probe-box{color:red;}.probe-box:hover{color:blue;}"))

  (test-case "a raw-string fragment passes through verbatim"
    (check-equal? (fragment->css probe-raw) probe-raw)
    (check-true (string-contains? (stylesheet) probe-raw)))

  ;; ---- the registry -------------------------------------------------------

  (test-case "require order is cascade order: theme first, then this module"
    (define css (stylesheet))
    (define theme-at (index-of-substring css "--l-paper:"))
    (define probe-at (index-of-substring css ".probe-box{"))
    (check-not-false theme-at css)
    (check-not-false probe-at css)
    (check-true (< theme-at probe-at)))

  (test-case "within a module, definition order is preserved"
    (define css (stylesheet))
    (define box-at (index-of-substring css ".probe-box{"))
    (define badge-at (index-of-substring css ".probe-badge{"))
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
                css)))
