#lang racket/base

;; Append a capture task under Inbox (or an anchored parent) in an outline file.
;; Preserves existing content; only inserts new lines at a computed position.

(require racket/list
         racket/match
         racket/string
         olai/fail
         olai/lang/line)

(provide format-capture-lines
         find-inbox-insert
         find-parent-insert
         append-capture)

;; Lines to insert for a new task under a parent at the given child indent.
(define (format-capture-lines title #:indent [indent 2] #:date [date #f] #:description [desc #f])
  (define pad (make-string indent #\space))
  (define mpad (make-string (+ indent 2) #\space))
  (define head (string-append pad title))
  (define meta
    (append
     (if desc (list (string-append mpad ": " desc)) '())
     (if date (list (string-append mpad "@date " date)) '())))
  (cons head meta))

;; What the insert-point scan needs: 'blank | 'lang
;; | (list 'title level title anchor) | (list 'other level content)
(define (scan-line s)
  (define-values (ind content) (line-indent+content s))
  (define k (classify-line content))
  (define level (quotient ind 2))
  (cond
    [(line-blank? k) 'blank]
    [(line-lang? k) 'lang]
    [(and (line-title? k) (even? ind))
     (list 'title level (title-text k) (title-anchor k))]
    [else (list 'other level content)]))

;; Returns (values insert-pos has-parent? task-line-1-based parent-indent)
;; parent-spec: #f | string title | (cons 'anchor id-string)
(define (find-parent-insert text parent-spec)
  (define lines (string-split text "\n" #:trim? #f))
  (define-values (want-title want-anchor)
    (match parent-spec
      [#f (values "Inbox" #f)]
      [(? string? title) (values title #f)]
      [(cons 'anchor anchor) (values #f anchor)]
      [_ (values #f #f)]))

  (define-values (parent-line parent-indent end-line)
    (let loop ([i 0] [pline #f] [pind 0] [seen? #f])
      (cond
        [(>= i (length lines))
         (values pline pind (length lines))]
        [else
         (match (scan-line (list-ref lines i))
           [(list 'title level title anchor)
            (define match?
              (cond
                [want-anchor (equal? anchor want-anchor)]
                [else (and (= level 0) (equal? title want-title))]))
            (cond
              [(and (not seen?) match?)
               (loop (add1 i) i (* level 2) #t)]
              [(and seen? want-title (zero? level))
               ;; next top-level ends Inbox-style section
               (values pline pind i)]
              [(and seen? want-anchor
                    (<= level (quotient pind 2)))
               ;; next sibling-or-above ends anchored section
               (values pline pind i)]
              [else
               (loop (add1 i) pline pind seen?)])]
           [_ (loop (add1 i) pline pind seen?)])])))

  (define insert-line
    (let loop ([e end-line])
      (cond
        [(or (not parent-line) (<= e (add1 parent-line))) e]
        [(eq? (scan-line (list-ref lines (sub1 e))) 'blank)
         (loop (sub1 e))]
        [else e])))
  (define (line-start-offset line-idx)
    (for/sum ([j (in-range line-idx)])
      (add1 (string-length (list-ref lines j)))))
  (cond
    [(not parent-line)
     (values (string-length text) #f
             (add1 (length (filter (λ (s) (not (string=? s ""))) lines)))
             0)]
    [else
     (values (line-start-offset insert-line) #t (add1 insert-line) parent-indent)]))

(define (find-inbox-insert text)
  (define-values (pos has? line _ind) (find-parent-insert text #f))
  (values pos has? line))

(define (ensure-nl s)
  (if (or (string=? s "") (regexp-match? #px"\n$" s)) s (string-append s "\n")))

;; parent: #f (Inbox) | string title | "^anchor" | (cons 'anchor id)
;; -> (values new-text task-line-number created-parent?)
(define (append-capture text title
                        #:date [date #f]
                        #:description [desc #f]
                        #:parent [parent #f])
  (define parent-spec
    (match parent
      [#f #f]
      [(regexp #px"^\\^([A-Za-z0-9_-]+)$" (list _ anchor)) (cons 'anchor anchor)]
      [_ parent]))
  (define-values (pos has-parent? line-no parent-indent)
    (find-parent-insert text parent-spec))
  (define child-indent
    (if has-parent? (+ parent-indent 2) 2))
  (define body-lines
    (format-capture-lines title #:indent child-indent #:date date #:description desc))
  (define create-inbox?
    (and (not has-parent?) (not parent-spec)))
  (define block
    (cond
      [has-parent? (string-append (string-join body-lines "\n") "\n")]
      [create-inbox?
       (string-append "Inbox\n" (string-join body-lines "\n") "\n")]
      [(pair? parent-spec)
       (user-fail "no task with anchor ^~a" (cdr parent-spec))]
      [else (user-fail "no task titled ~s" parent-spec)]))
  (define prefix (substring text 0 pos))
  (define suffix (substring text pos))
  (define new-text
    (if has-parent?
        (string-append (if (string=? prefix "") "" (ensure-nl prefix))
                       block
                       suffix)
        (string-append (if (string=? text "") "" (ensure-nl text))
                       block)))
  (values new-text
          (if has-parent? line-no (appended-line-number text))
          create-inbox?))

;; Where a block appended to the end of `text` starts, 1-based: past every
;; line the text already has, plus the "Inbox" line written above the task.
(define (appended-line-number text)
  (define base-text (if (string=? text "") "" (ensure-nl text)))
  (define lines (string-split base-text "\n" #:trim? #f))
  (define line-count
    (if (and (pair? lines) (string=? (last lines) ""))
        (sub1 (length lines))
        (length lines)))
  (+ line-count 2))

