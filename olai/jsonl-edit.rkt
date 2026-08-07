#lang racket/base

;; Text mutators for flat-record JSONL outlines — the jsonl twin of
;; olai/status, olai/capture and olai/move. Each takes whole-file text and
;; returns whole-file text; the write path (olai/edit) still owns
;; validate-then-rename.

(require racket/contract
         racket/list
         racket/match
         racket/string
         olai/dates
         olai/fail
         (only-in olai/lang/jsonl
                  jsonl-find-by-id
                  jsonl-find-by-title
                  jsonl-insert-child
                  jsonl-mint-id
                  jsonl-update-record)
         (only-in olai/meta parse-title-or-anchor spec-label))

(provide (contract-out
          [jsonl-mark-done-in-text
           (->* (string? string? string?)
                (#:at (or/c exact-nonnegative-integer? #f))
                any)]
          [jsonl-undo-done-in-text
           (->* (string? string?)
                (#:at (or/c exact-nonnegative-integer? #f))
                any)]
          [jsonl-mark-doing-in-text
           (->* (string? string? string?)
                (#:at (or/c exact-nonnegative-integer? #f))
                any)]
          [jsonl-undo-doing-in-text
           (->* (string? string?)
                (#:at (or/c exact-nonnegative-integer? #f))
                any)]
          [jsonl-set-date-in-text
           (->* (string? string? string?)
                (#:at (or/c exact-nonnegative-integer? #f))
                any)]
          [jsonl-clear-date-in-text
           (->* (string? string?)
                (#:at (or/c exact-nonnegative-integer? #f))
                any)]
          [jsonl-append-capture
           (->* (string? string?)
                (#:date (or/c string? #f)
                 #:description (or/c string? #f)
                 #:parent (or/c string? #f))
                any)]
          [jsonl-resolve-line
           (->* (string? string?)
                (#:at (or/c exact-nonnegative-integer? #f))
                (values exact-positive-integer? hash? string?))]))

;; ---- resolve a TITLE|^anchor to a record ------------------------------------

;; index is 0-based (matches located-index / outline text mutators).
;; #:at when set is the 0-based index the resolver already picked.
(define (jsonl-resolve-line text spec #:at [at #f])
  (define want (parse-title-or-anchor spec))
  (define hits
    (match want
      [(cons 'anchor a)
       (define hit (jsonl-find-by-id text a))
       (if hit (list hit) '())]
      [(cons 'title t) (jsonl-find-by-title text t)]))
  (define hits*
    (if at
        (filter (λ (p) (= (sub1 (car p)) at)) hits)
        hits))
  (define label (spec-label spec))
  (cond
    [(null? hits*)
     (user-fail "no task matching ~a" label)]
    [(> (length hits*) 1)
     (user-fail "ambiguous title ~a; matches: ~a; use an id to disambiguate"
                label
                (string-join
                 (for/list ([h (in-list hits*)])
                   (format "line ~a" (car h)))
                 ", "))]
    [else
     (define p (car hits*))
     (define h (cdr p))
     (unless (hash-has-key? h 'title)
       (user-fail "~a is not a task record (line ~a)" label (car p)))
     (values (car p) h (hash-ref h 'title))]))

;; ---- mark helpers -----------------------------------------------------------

(define (has-done? h)
  (hash-has-key? h 'done))

(define (has-doing? h)
  (hash-has-key? h 'doing))

(define (jsonl-mark-done-in-text text spec today #:at [at #f])
  (define-values (line h title) (jsonl-resolve-line text spec #:at at))
  (when (has-done? h)
    (user-fail "~a is already done (line ~a)" title line))
  (define-values (new _)
    (jsonl-update-record
     text line
     (λ (rec)
       (define r (hash-remove rec 'doing))
       (hash-set r 'done today))))
  (values new line))

(define (jsonl-undo-done-in-text text spec #:at [at #f])
  (define-values (line h title) (jsonl-resolve-line text spec #:at at))
  (unless (has-done? h)
    (user-fail "~a is not done (line ~a)" title line))
  (define-values (new _)
    (jsonl-update-record text line (λ (rec) (hash-remove rec 'done))))
  (values new line))

(define (jsonl-mark-doing-in-text text spec today #:at [at #f])
  (define-values (line h title) (jsonl-resolve-line text spec #:at at))
  (when (has-done? h)
    (user-fail "~a is already done (line ~a)" title line))
  (when (has-doing? h)
    (user-fail "~a is already doing (line ~a)" title line))
  (define-values (new _)
    (jsonl-update-record text line (λ (rec) (hash-set rec 'doing today))))
  (values new line))

(define (jsonl-undo-doing-in-text text spec #:at [at #f])
  (define-values (line h title) (jsonl-resolve-line text spec #:at at))
  (unless (has-doing? h)
    (user-fail "~a is not doing (line ~a)" title line))
  (define-values (new _)
    (jsonl-update-record text line (λ (rec) (hash-remove rec 'doing))))
  (values new line))

;; ---- date -------------------------------------------------------------------

(define (jsonl-set-date-in-text text spec date-str #:at [at #f])
  (unless (valid-iso-date-string? date-str)
    (user-fail "invalid date ~s; expected YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS]"
               date-str))
  (define date* (normalize-date-string date-str))
  (define-values (line h title) (jsonl-resolve-line text spec #:at at))
  (define-values (new _)
    (jsonl-update-record text line (λ (rec) (hash-set rec 'date date*))))
  (values new line title date*))

(define (jsonl-clear-date-in-text text spec #:at [at #f])
  (define-values (line h title) (jsonl-resolve-line text spec #:at at))
  (unless (hash-has-key? h 'date)
    (user-fail "~a has no @date to clear (line ~a)" title line))
  (define-values (new _)
    (jsonl-update-record text line (λ (rec) (hash-remove rec 'date))))
  (values new line title))

;; ---- capture / add ----------------------------------------------------------

;; parent: #f (top-level Inbox) | title string | "^anchor"
;; -> (values new-text line created-inbox?)
(define (jsonl-append-capture text title
                              #:date [date #f]
                              #:description [desc #f]
                              #:parent [parent #f])
  (define parent-id
    (match parent
      [#f
       ;; Inbox by title, or create one
       (define hits (jsonl-find-by-title text "Inbox"))
       (cond
         [(null? hits) 'create-inbox]
         [(> (length hits) 1)
          (user-fail "ambiguous title ~s; matches at lines ~a"
                     "Inbox"
                     (string-join (map (λ (h) (format "~a" (car h))) hits) ", "))]
         [else (hash-ref (cdr (car hits)) 'id)])]
      [(regexp #px"^\\^([A-Za-z0-9_-]+)$" (list _ a))
       (define hit (jsonl-find-by-id text a))
       (unless hit (user-fail "no task with anchor ^~a" a))
       (hash-ref (cdr hit) 'id)]
      [(? string? t)
       (define hits (jsonl-find-by-title text t))
       (cond
         [(null? hits) (user-fail "no task titled ~s" t)]
         [(> (length hits) 1)
          (user-fail "ambiguous title ~s; use an id to disambiguate" t)]
         [else (hash-ref (cdr (car hits)) 'id)])]
      [_ (user-fail "bad parent ~v" parent)]))
  (cond
    [(eq? parent-id 'create-inbox)
     (define inbox-id (jsonl-mint-id text))
     (define-values (text1 _line1)
       (jsonl-insert-child text #f
                           (hash 'id inbox-id 'title "Inbox")))
     (define child-id (jsonl-mint-id text1))
     (define fields
       (let* ([h (hash 'id child-id 'title title)]
              [h (if date (hash-set h 'date date) h)]
              [h (if desc (hash-set h 'desc desc) h)])
         h))
     (define-values (text2 line2)
       (jsonl-insert-child text1 inbox-id fields))
     (values text2 line2 #t)]
    [else
     (define child-id (jsonl-mint-id text))
     (define fields
       (let* ([h (hash 'id child-id 'title title)]
              [h (if date (hash-set h 'date date) h)]
              [h (if desc (hash-set h 'desc desc) h)])
         h))
     (define-values (text2 line2)
       (jsonl-insert-child text parent-id fields))
     (values text2 line2 #f)]))
