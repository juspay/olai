#lang racket/base

;; Line-oriented outline parser for #lang selfflowy.
;; Emits (t "title" #:date ... #:description ... child ...) syntax with srclocs.

(require racket/list
         racket/match
         racket/string
         syntax/readerr)

(provide parse-outline-port
         parse-outline-string)

(struct raw-line (n col text indent content) #:transparent)

;; descs: list of (list text line col) newest-first
;; date-info: #f or (list value line col)
(struct node (title date-info descs children line col span src) #:mutable #:transparent)

(define (reader-error src line col pos msg . args)
  (raise-read-error
   (if (null? args) msg (apply format msg args))
   src line col pos #f))

(define (count-indent s src line)
  (define len (string-length s))
  (let loop ([i 0])
    (cond
      [(>= i len) (values i "" i)]
      [(char=? (string-ref s i) #\tab)
       (reader-error src line i #f
                     "tabs are not allowed in indentation; use spaces (2 per level)")]
      [(char=? (string-ref s i) #\space)
       (loop (add1 i))]
      [else (values i (substring s i) i)])))

(define (read-raw-lines src in)
  (define lines '())
  (let loop ([n 1])
    (define s (read-line in 'any))
    (cond
      [(eof-object? s) (reverse lines)]
      [else
       (define-values (ind content col) (count-indent s src n))
       (set! lines (cons (raw-line n col s ind content) lines))
       (loop (add1 n))])))

(define (blank-content? c)
  (or (string=? c "") (regexp-match? #px"^\\s*$" c)))

(define (classify-content content src line col)
  (cond
    [(blank-content? content) 'blank]
    [(regexp-match? #px"^\\\\" content)
     `(title ,(substring content 1))]
    [(regexp-match #px"^: (.*)$" content)
     => (λ (m) `(desc ,(cadr m)))]
    [(regexp-match #px"^:($|[^ ].*)$" content)
     (reader-error src line col #f
                   "description line must start with \": \" (colon + space)")]
    [(regexp-match #px"^@date[ \t]+(\\S+)(.*)$" content)
     => (λ (m)
          (define rest (caddr m))
          (unless (regexp-match? #px"^[ \t]*$" rest)
            (reader-error src line col #f
                          "trailing junk after @date; expected only a YYYY-MM-DD value"))
          ;; column of the date value: after indent + "@date" + spaces
          (define prefix-m (regexp-match #px"^@date[ \t]+" content))
          (define val-col (+ col (string-length (car prefix-m))))
          `(date ,(cadr m) ,val-col))]
    [(regexp-match #px"^@date\\s*$" content)
     (reader-error src line col #f
                   "expected a date after @date (YYYY-MM-DD)")]
    [(regexp-match #px"^@(\\S+)" content)
     => (λ (m)
          (reader-error src line col #f
                        "unknown @~a; known fields: @date"
                        (cadr m)))]
    [else `(title ,content)]))

(define (level-of indent src line col)
  (unless (zero? (remainder indent 2))
    (reader-error src line col #f
                  "indentation must be a multiple of 2 spaces (got ~a)"
                  indent))
  (quotient indent 2))

(define (loc-vec src line col span)
  (vector src line col #f span))

(define (node->syntax nd)
  (define src (node-src nd))
  (define line (node-line nd))
  (define col (node-col nd))
  (define span (node-span nd))
  (define title-stx
    (datum->syntax #f (node-title nd) (loc-vec src line col span)))
  (define date-part
    (match (node-date-info nd)
      [(list d dline dcol)
       (list (datum->syntax #f '#:date (loc-vec src dline dcol 5))
             (datum->syntax #f d (loc-vec src dline dcol (string-length d))))]
      [#f '()]))
  (define desc-part
    (let ([ds (node-descs nd)])
      (if (null? ds)
          '()
          (let* ([texts (map car (reverse ds))]
                 [joined (string-join texts "\n")]
                 ;; use first description line for srcloc
                 [first (last ds)]
                 [dline (cadr first)]
                 [dcol (caddr first)])
            (list (datum->syntax #f '#:description (loc-vec src dline dcol 1))
                  (datum->syntax #f joined
                                (loc-vec src dline dcol (string-length joined))))))))
  (define kids (map node->syntax (reverse (node-children nd))))
  (define form
    (cons (datum->syntax #f 't (loc-vec src line col span))
          (append (list title-stx) date-part desc-part kids)))
  (datum->syntax #f form (loc-vec src line col span)))

(define (parse-lines src lines)
  (define roots '())
  (define stack '())

  (define (current-depth) (length stack))

  (define (last-node-at level)
    (and (< level (length stack))
         (list-ref stack level)))

  (define (push-node! nd level)
    (when (> level 0)
      (define parent (list-ref stack (sub1 level)))
      (set-node-children! parent (cons nd (node-children parent))))
    (when (zero? level)
      (set! roots (cons nd roots)))
    (set! stack (append (take stack level) (list nd))))

  (for ([rl (in-list lines)])
    (define n (raw-line-n rl))
    (define col (raw-line-col rl))
    (define ind (raw-line-indent rl))
    (define content (raw-line-content rl))
    (define kind (classify-content content src n col))
    (cond
      [(eq? kind 'blank) (void)]
      [else
       (define level (level-of ind src n col))
       (match kind
         [`(title ,title)
          (when (> level (current-depth))
            (reader-error src n col #f
                          "indent jumps more than one level (from ~a to ~a); use 2 spaces per level"
                          (current-depth) level))
          (when (and (zero? (current-depth)) (positive? level))
            (reader-error src n col #f
                          "indent jumps more than one level (from 0 to ~a); top-level tasks must start at column 0"
                          level))
          (set! stack (take stack level))
          (define nd
            (node title #f '() '() n col (string-length title) src))
          (push-node! nd level)]
         [`(desc ,text)
          (when (zero? level)
            (reader-error src n col #f
                          "description line with no title above"))
          (define parent (last-node-at (sub1 level)))
          (unless parent
            (reader-error src n col #f
                          "description line with no title above"))
          (set-node-descs! parent (cons (list text n col) (node-descs parent)))]
         [`(date ,d ,val-col)
          (when (zero? level)
            (reader-error src n col #f
                          "@date with no title above"))
          (define parent (last-node-at (sub1 level)))
          (unless parent
            (reader-error src n col #f
                          "@date with no title above"))
          (when (node-date-info parent)
            (reader-error src n col #f
                          "duplicate @date on this task"))
          (set-node-date-info! parent (list d n val-col))])]))
  (map node->syntax (reverse roots)))

(define (parse-outline-port src in)
  (parse-lines src (read-raw-lines src in)))

(define (parse-outline-string src str)
  (define in (open-input-string str))
  (port-count-lines! in)
  (parse-outline-port src in))
