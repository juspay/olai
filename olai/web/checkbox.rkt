#lang racket/base

;; THE CHECKBOX: three readings of one box — empty, half-filled, checked.
;;
;; It sits in the gutter rather than in the text run, so a title and its note
;; stay flush left of each other. The bullet is the node; this only shows up
;; when it matters — on hover, on focus, or once the node is in a state.

(require racket/contract
         olai/web/theme
         olai/web/style
         (only-in olai/web/states is-done is-doing state-class))

(provide (contract-out
          ;; key, the element id of the copy you clicked, the node's status,
          ;; and where a toggle would POST. No toggle-base is a read-only box
          [checkbox-xexpr
           (-> string? string? symbol? (or/c string? #f) list?)])
         ;; the class web/node reaches for in the one rule about the ROW that
         ;; happens to be about this box
         ol-check)

(define-component (checkbox-xexpr key element-id status toggle-base)
  #:class ol-check
  #:css (#:flex (0 0 1.125rem)
         #:width 1.125rem
         #:height 1.5rem
         #:display inline-flex
         #:align-items center
         #:justify-content center
         #:padding 0
         #:border 0
         #:background none
         #:color ,dim
         #:font-size 0.8125rem
         #:line-height 1
         #:cursor pointer
         #:user-select none
         #:opacity 0
         #:transition (opacity 120ms ease)
         ;; visible once it matters. The other half of this — reveal on the
         ;; ROW's hover — is a rule about the row, so web/node writes it
         [(: & focus-visible) ,(sel '& is-done) ,(sel '& is-doing) #:opacity 1]
         [,(sel '& is-done) #:color ,green]
         [,(sel '& is-doing) #:color ,amber-fg]
         ;; no hover on a phone: the box has to stay put, and a finger needs
         ;; room around it. A node in a state was already visible; open ones
         ;; were not
         [@ media (#:max-width ,phone-max)
            #:opacity 1
            #:flex (0 0 1.75rem)
            #:width 1.75rem
            #:height 1.75rem
            #:font-size 1rem])
  ;; the same box in three readings: empty, half-filled, checked. One switch,
  ;; so what a state looks like and what it is called cannot drift apart
  (define-values (label hint)
    (case status
      [(done) (values "☑" "done")]
      [(doing) (values "◧" "doing")]
      [else (values "☐" "not done")]))
  (define done? (eq? status 'done))
  (define common
    `((class ,(classes ol-check (state-class status)))
      (title ,hint)))
  (if toggle-base
      ;; post against the node (its key), swap the copy you clicked (its
      ;; element id, minted by the region that drew it — this never computes
      ;; an id shape).
      ;; DORMANT and grandfathered: no route serves a toggle, so nothing but a
      ;; test reaches this. Raw htmx attributes are banned (live/README.md) —
      ;; 0.6's write path brings a ratified write FORM, and this goes with it.
      `(button ((type "button")
                ,@common
                (hx-post ,(string-append toggle-base key))
                (hx-target ,(string-append "#" element-id))
                (hx-swap "outerHTML")
                (aria-label ,(if done? "mark not done" "mark done")))
               ,label)
      `(span (,@common (aria-hidden "true")) ,label)))

;; A box you can press is a <button>; the read-only copy is a <span>, and only
;; the button answers a hover. CSS nesting has no spelling for "the parent,
;; but only when it is a button", so this rule is written out.
(register-fragment!
 (css-expr [(: ,(sel 'button ol-check) hover) #:color ,green]))
