#lang racket/base

;; CSS as code: class names are Racket bindings, styles sit next to what they
;; style, and the stylesheet is generated.
;;
;; The move is the one the outline language already makes for anchors —
;; define before use. A class name that nothing defines is an unbound
;; identifier at compile time, not a selector that quietly matches nothing at
;; 3am. Renaming a class renames every selector and every xexpr that wears it,
;; because they are the same binding.
;;
;; This module is the MECHANISM and knows nothing about olai's design: no
;; colors, no class names, no components. It owns three things — the
;; identifier -> class-name rule, the registry, and the trip to CSS. The
;; serializer is css-expr's; nothing here writes CSS by hand.
;;
;; ORDERING IS THE CASCADE. Fragments come out in the order their modules were
;; instantiated, and a module is instantiated when it is first required. So
;; require order = cascade order: theme.rkt before the components that lean on
;; its tokens, base rules before the classes that override them. A module that
;; wants to win writes itself last, not louder.

(require (for-syntax racket/base syntax/parse)
         racket/contract
         racket/string
         css-expr)

(provide define-style
         define-component
         define-modifier
         ;; the CSS-expression form itself: this module owns the css-expr
         ;; dependency, so a client requires style.rkt and nothing else
         css-expr
         (contract-out
          ;; A fragment is a css-expr stylesheet (a list of rules) or a raw
          ;; CSS string. The string is the escape hatch for what css-expr
          ;; cannot spell; every use gets a comment saying why.
          [register-fragment! (-> (or/c string? list?) void?)]
          [fragment->css (-> (or/c string? list?) string?)]
          [stylesheet (-> string?)]
          ;; class names -> a css-expr selector datum, for use under unquote
          [sel (->* ((or/c string? symbol?))
                    #:rest (listof (or/c string? symbol?))
                    (or/c symbol? list?))]))

;; ---- selectors ------------------------------------------------------------

;; Class names are strings (that is what an xexpr class attribute wants);
;; css-expr selectors are symbols. `sel` is the crossing, and it builds the
;; whole compound in one call so a selector reads like the CSS it becomes:
;;
;;   (sel sf-node is-collapsed)   -> .sf-node.is-collapsed
;;   (sel 'body sf-body)          -> body.sf-body
;;
;; Use it under unquote; css-expr is quasiquote, so it composes with every
;; combinator css-expr has:
;;
;;   (css-expr [(> ,(sel sf-node is-collapsed)
;;                 (,(sel sf-row) (:: ,(sel sf-bullet has-children) before)))
;;              #:content ""])
(define (sel part . parts)
  (for/fold ([acc #f]) ([p (in-list (cons part parts))])
    (cond
      [(symbol? p)
       (when acc (error 'sel "a tag has to lead the selector; got ~e after ~e" p acc))
       p]
      [acc (list '|.| acc (string->symbol p))]
      [else (list '|.| (string->symbol p))])))

;; ---- the registry ---------------------------------------------------------

;; Appended in module-instantiation order; reversed once, on the way out.
(define fragments '())

(define (register-fragment! fragment)
  (set! fragments (cons fragment fragments)))

(define (fragment->css fragment)
  (if (string? fragment) fragment (css-expr->css fragment)))

(define (stylesheet)
  (string-join (for/list ([f (in-list (reverse fragments))]) (fragment->css f))
               "\n"))

;; ---- the macros -----------------------------------------------------------

;; (define-style sf-node rule ...) binds sf-node to "sf-node" and registers
;; `.sf-node { rule ... }`. Rules are css-expr block elements, so a nested
;; rule with `&` reaches the states and children of the same class:
;;
;;   (define-style sf-crumb
;;     #:text-decoration none
;;     [(: & hover) #:text-decoration underline])
;;
;; #:tag qualifies the selector with an element (body.sf-body). Rare: a class
;; that only ever lands on one tag, where the tag is part of what the rule
;; means.
(define-syntax (define-style stx)
  (syntax-parse stx
    [(_ name:id (~optional (~seq #:tag tag:id)) rule ...+)
     #:with class-name (datum->syntax #'name (symbol->string (syntax-e #'name)))
     #:with selector (if (attribute tag)
                         #'(sel 'tag class-name)
                         #'(sel class-name))
     #'(begin
         (define name class-name)
         (register-fragment! (list (cons selector (css-expr rule ...)))))]))

;; A component is a render function and its styles in one place. `cls` is
;; bound to its class-name string for both the CSS and the body, so the markup
;; and the rule that paints it cannot drift apart:
;;
;;   (define-component (crumb-sep)
;;     #:class sf-crumb-sep
;;     #:css (#:color (apply var --line))
;;     `(span ((class ,sf-crumb-sep) (aria-hidden "true")) "›"))
(define-syntax (define-component stx)
  (syntax-parse stx
    [(_ (name:id arg ...) #:class cls:id #:css (rule ...+) body ...+)
     #'(begin
         (define-style cls rule ...)
         (define (name arg ...) body ...))]))

;; A state class: is-done, has-children, is-open. It carries no rules of its
;; own — it appears inside other components' selectors, and in the JS that
;; toggles it. Binding it is the whole point: the string exists once, and both
;; sides of the toggle spell it from there.
(define-syntax (define-modifier stx)
  (syntax-parse stx
    [(_ name:id)
     #:with class-name (datum->syntax #'name (symbol->string (syntax-e #'name)))
     #'(define name class-name)]))
