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
;; identifier -> CSS name rules (a class, a token), the registry, and the trip
;; to CSS. The serializer is css-expr's; nothing here writes CSS by hand.
;;
;; ORDERING IS THE CASCADE, and it is decided in two steps. A fragment's LAYER
;; comes first — 'base (tokens and the document's own rules), 'component
;; (nearly everything: a module's own classes), 'overlay (a rule whose subject
;; belongs to another module, and which therefore has to land after it).
;; Within a layer, fragments come out in the order their modules were
;; instantiated, and a module is instantiated when it is first required. So
;; require order is still the cascade — the layer is what a rule says out loud
;; when leaning on it would otherwise be a require in the right place and
;; nothing saying why. Not CSS `@layer`: that changes what wins, and this sheet
;; was ported rule for rule.

(require (for-syntax racket/base syntax/parse)
         racket/contract
         racket/list
         racket/string
         css-expr)

(provide define-style
         define-component
         define-modifier
         define-tokens
         ;; the CSS-expression form itself: this module owns the css-expr
         ;; dependency, so a client requires style.rkt and nothing else
         css-expr
         (contract-out
          ;; the three cascade layers, in the order they come out
          [css-layer? (-> any/c boolean?)]
          ;; A fragment is a css-expr stylesheet (a list of rules) or a raw
          ;; CSS string. The string is the escape hatch for what css-expr
          ;; cannot spell; every use gets a comment saying why.
          [register-fragment! (->* ((or/c string? list?)) (#:layer css-layer?) void?)]
          [fragment->css (-> (or/c string? list?) string?)]
          [stylesheet (-> string?)]
          ;; every class this program has DEFINED, in definition order. The
          ;; JS reads classes the Racket side never writes; this is what a
          ;; test compares that against.
          [class-names (-> (listof string?))]
          ;; class names -> one xexpr class attribute, #f parts dropped:
          ;;   (classes sf-node (and done? is-done)) -> "sf-node is-done"
          [classes (->* () #:rest (listof (or/c string? #f)) string?)]
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
;;   (sel '& is-done)             -> &.is-done, inside a nested rule
;;
;; A nested rule that does not mention & is read as a DESCENDANT of its
;; parent, so a rule about the parent in another state spells the & itself.
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

;; The other crossing, the one an xexpr wants: several class names into one
;; attribute value, with #f for "not in this state". `(and done? is-done)`
;; reads as the condition it is.
(define (classes . parts)
  (string-join (filter values parts) " "))

;; ---- the registry ---------------------------------------------------------

;; The layers, in the order they come out of the sheet.
(define layer-order '(base component overlay))

(define (css-layer? v) (and (memq v layer-order) #t))

;; Appended in module-instantiation order as (layer . fragment); reversed once
;; and sorted by layer on the way out.
(define fragments '())

;; Same order, names only. A class is DEFINED here and used in three places —
;; a selector, an xexpr, a .js — and only the first two are checked by the
;; compiler. This is what lets a test check the third.
(define defined-classes '())

(define (register-fragment! fragment #:layer [layer 'component])
  (set! fragments (cons (cons layer fragment) fragments)))

;; A class has ONE owner. Registering the same name twice is two modules with
;; rules for one piece of markup — and the one whose require lands second wins,
;; silently, in whichever order the day's require graph happens to take.
(define (register-class! name)
  (when (member name defined-classes)
    (error 'style "class ~a is defined twice; a class has one owner" name))
  (set! defined-classes (cons name defined-classes)))

(define (class-names) (reverse defined-classes))

(define (fragment->css fragment)
  (if (string? fragment) fragment (css-expr->css fragment)))

;; Layer first, instantiation order second — `sort` is stable, so the second
;; costs nothing to keep.
(define (stylesheet)
  (define ordered
    (sort (reverse fragments) < #:key (λ (f) (index-of layer-order (car f)))))
  (string-join (for/list ([f (in-list ordered)]) (fragment->css (cdr f)))
               "\n"))

;; ---- the macros -----------------------------------------------------------

;; Three prefixes, and no fourth: sf- is a piece of the skin, is- and has- are
;; states something else is in. The convention is not decoration — the test
;; that reads class-shaped names out of the .js files finds them by these
;; prefixes, so a class that wore a fourth one would be outside that border
;; without anyone deciding it should be. Checked where names are MADE, which
;; makes the border complete by construction.
(begin-for-syntax
  (define (check-class-name! id)
    (unless (regexp-match? #px"^(sf|is|has)-[a-z0-9]"
                           (symbol->string (syntax-e id)))
      (raise-syntax-error #f "a class name starts with sf-, is- or has-" id))))

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
;; means. #:layer says which cascade layer the rule belongs to ('component
;; unless it says otherwise).
;;
;; The subject may also be a LIST of names — one control with three jobs, one
;; block of rules:
;;
;;   (define-style (sf-chat-btn sf-chat-send sf-chat-stop) #:cursor pointer)
;;
;; which binds all three and registers .sf-chat-btn,.sf-chat-send,.sf-chat-stop
;; once. A nested rule under that form reaches all three, which is what the
;; grouping means; anything that is true of only one of them is its own rule.
(define-syntax (define-style stx)
  (syntax-parse stx
    [(_ (name:id ...+) (~optional (~seq #:layer layer:expr)) rule ...+)
     #:with (class-name ...) (for/list ([n (in-list (syntax->list #'(name ...)))])
                               (check-class-name! n)
                               (datum->syntax n (symbol->string (syntax-e n))))
     #:with the-layer (or (attribute layer) #''component)
     #'(begin
         (begin (define name class-name) (register-class! class-name)) ...
         (register-fragment! (list (append (list (sel class-name) ...)
                                           (css-expr rule ...)))
                             #:layer the-layer))]
    [(_ name:id (~alt (~optional (~seq #:tag tag:id))
                      (~optional (~seq #:layer layer:expr))) ...
        rule ...+)
     #:with class-name (begin (check-class-name! #'name)
                              (datum->syntax #'name (symbol->string (syntax-e #'name))))
     #:with selector (if (attribute tag)
                         #'(sel 'tag class-name)
                         #'(sel class-name))
     #:with the-layer (or (attribute layer) #''component)
     #'(begin
         (define name class-name)
         (register-class! class-name)
         (register-fragment! (list (cons selector (css-expr rule ...)))
                             #:layer the-layer))]))

;; A component is a render function and its styles in one place. `cls` is
;; bound to its class-name string for both the CSS and the body, so the markup
;; and the rule that paints it cannot drift apart:
;;
;;   (define-component (crumb-sep)
;;     #:class sf-crumb-sep
;;     #:css (#:color ,line)
;;     `(span ((class ,sf-crumb-sep) (aria-hidden "true")) "›"))
(define-syntax (define-component stx)
  (syntax-parse stx
    [(_ (name:id arg ...) #:class cls:id
        (~optional (~seq #:layer layer:expr))
        #:css (rule ...+) body ...+)
     #:with the-layer (or (attribute layer) #''component)
     #'(begin
         (define-style cls #:layer the-layer rule ...)
         (define (name arg ...) body ...))]))

;; The same argument as for class names, one level down: a design token is a
;; custom property, and the module that declares --ink and the module that
;; reads it should be spelling one binding, not one string twice.
;;
;;   (define-tokens palette-tokens paper ink dim)
;;
;; binds `palette-tokens` to '(paper ink dim) — what a generator folds over —
;; and each name to the css-expr datum for var(--name), for use under unquote:
;;
;;   (define-style sf-note #:color ,dim #:border (1px solid ,line))
;;
;; They are PROVIDED as well as defined: a token no other module can spell is
;; not a token, it is a local. No contracts — a token is a constant datum, and
;; a flat check on a constant says nothing a compile does not.
(define-syntax (define-tokens stx)
  (syntax-parse stx
    [(_ list-name:id token:id ...+)
     #:with (property ...)
     (for/list ([t (in-list (syntax->list #'(token ...)))])
       (datum->syntax t (string->symbol
                         (string-append "--" (symbol->string (syntax-e t))))))
     #'(begin
         (define list-name '(token ...))
         (begin (define token '(apply var property)) ...)
         (provide list-name token ...))]))

;; A class with no rules of its own. Two kinds wear it: a STATE (is-done,
;; has-children, is-open) that appears inside other components' selectors and
;; in the JS that toggles it, and a HOOK (sf-pane, sf-chat-sink) that only JS
;; or a test addresses. Binding it is the whole point: the string exists once,
;; and both sides spell it from there. It binds only, and no longer stands in
;; for a rule with several subjects — define-style takes a list for that.
(define-syntax (define-modifier stx)
  (syntax-parse stx
    [(_ name:id ...+)
     #:with (class-name ...) (for/list ([n (in-list (syntax->list #'(name ...)))])
                               (check-class-name! n)
                               (datum->syntax n (symbol->string (syntax-e n))))
     #'(begin
         (begin (define name class-name) (register-class! class-name)) ...)]))
