#lang racket/base

;; Line-oriented outline parser for #lang selfflowy.
;; Emits (t "title" #:id ... #:date ... #:description ... #:done ... child ...)
;; and (mirror "anchor") with srclocs.

(require racket/list
         racket/match
         racket/string
         syntax/readerr)

(provide parse-outline-port
         parse-outline-string
         strip-checkbox-prefix
         strip-trailing-anchor)

(struct raw-line (n col text indent content) #:transparent)

;; descs: list of (list text line col) newest-first
;; date-info / done-info: #f or (list value line col)
;; id-info: #f or (list id-string line col)
;; mirror-anchor: #f or anchor string (when set, this node is a mirror leaf)
;; include-path: #f or relative path string (when set, this node is an include leaf)
(struct node (title date-info done-info id-info descs children line col span src mirror-anchor include-path)
  #:mutable #:transparent)

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

;; Title checkbox sugar: "[x] " / "[X] " → done (#t); "[ ] " → open (stripped).
(define (strip-checkbox-prefix title)
  (cond
    [(regexp-match #px"^\\[[xX]\\] (.*)$" title)
     => (λ (m) (values (cadr m) 'done))]
    [(regexp-match #px"^\\[ \\] (.*)$" title)
     => (λ (m) (values (cadr m) 'open))]
    [else (values title #f)]))

;; Trailing ^anchor (not part of the verbatim title).
;; Returns (values title-without-anchor anchor-or-#f).
(define (strip-trailing-anchor title)
  (cond
    [(regexp-match #px"^(.*\\S)\\s+\\^([A-Za-z0-9_-]+)\\s*$" title)
     => (λ (m) (values (cadr m) (caddr m)))]
    [(regexp-match #px"^\\^([A-Za-z0-9_-]+)\\s*$" title)
     => (λ (m) (values "" (cadr m)))]
    [else (values title #f)]))

(define (classify-content content src line col)
  (cond
    [(blank-content? content) 'blank]
    ;; Escape: title is rest after `\`; checkbox/mirror/anchor sugar does NOT apply.
    [(regexp-match? #px"^\\\\" content)
     `(title ,(substring content 1) #f #f)]
    ;; Mirror line: *anchor alone (line-initial *).
    [(regexp-match #px"^\\*([A-Za-z0-9_-]+)\\s*$" content)
     => (λ (m) `(mirror ,(cadr m)))]
    [(regexp-match #px"^: (.*)$" content)
     => (λ (m) `(desc ,(cadr m)))]
    [(regexp-match #px"^:($|[^ ].*)$" content)
     (reader-error src line col #f
                   "description line must start with \": \" (colon + space)")]
    [(regexp-match #px"^@date[ \t]+(\\S.*)$" content)
     => (λ (m)
          (define val (string-trim (cadr m)))
          (define prefix-m (regexp-match #px"^@date[ \t]+" content))
          (define val-col (+ col (string-length (car prefix-m))))
          `(date ,val ,val-col))]
    [(regexp-match #px"^@date\\s*$" content)
     (reader-error src line col #f
                   "expected a date or datetime after @date (YYYY-MM-DD[THH:MM[:SS]])")]
    [(regexp-match #px"^@done[ \t]+(\\S.*)$" content)
     => (λ (m)
          (define val (string-trim (cadr m)))
          (define prefix-m (regexp-match #px"^@done[ \t]+" content))
          (define val-col (+ col (string-length (car prefix-m))))
          `(done ,val ,val-col))]
    [(regexp-match #px"^@done\\s*$" content)
     `(done-bare ,col)]
    [(regexp-match #px"^@include[ \t]+(\\S.*)$" content)
     => (λ (m) `(include ,(string-trim (cadr m))))]
    [(regexp-match #px"^@include\\s*$" content)
     (reader-error src line col #f
                   "expected a relative path after @include")]
    [(regexp-match #px"^@(\\S+)" content)
     => (λ (m)
          (reader-error src line col #f
                        "unknown @~a; known fields: @date, @done, @include"
                        (cadr m)))]
    [else
     (define-values (title0 flag) (strip-checkbox-prefix content))
     (define-values (title anchor) (strip-trailing-anchor title0))
     (when (and anchor (string=? title ""))
       (reader-error src line col #f
                     "title required before ^~a" anchor))
     `(title ,title ,flag ,anchor)]))

(define (level-of indent src line col)
  (unless (zero? (remainder indent 2))
    (reader-error src line col #f
                  "indentation must be a multiple of 2 spaces (got ~a)"
                  indent))
  (quotient indent 2))

(define (loc-vec src line col span)
  (vector src line col #f span))

(define (node-mirror? nd)
  (and (node-mirror-anchor nd) #t))

(define (node-include? nd)
  (and (node-include-path nd) #t))

(define (node->syntax nd)
  (define src (node-src nd))
  (define line (node-line nd))
  (define col (node-col nd))
  (define span (node-span nd))
  (cond
    [(node-mirror? nd)
     (define a (node-mirror-anchor nd))
     (datum->syntax
      #f
      (list (datum->syntax #f 'mirror (loc-vec src line col span))
            (datum->syntax #f a (loc-vec src line col (string-length a))))
      (loc-vec src line col span))]
    [(node-include? nd)
     (define p (node-include-path nd))
     (datum->syntax
      #f
      (list (datum->syntax #f 'include (loc-vec src line col span))
            (datum->syntax #f p (loc-vec src line col (string-length p))))
      (loc-vec src line col span))]
    [else
     (define title-stx
       (datum->syntax #f (node-title nd) (loc-vec src line col span)))
     (define id-part
       (match (node-id-info nd)
         [(list id iline icol)
          (list (datum->syntax #f '#:id (loc-vec src iline icol 3))
                (datum->syntax #f id (loc-vec src iline icol (string-length id))))]
         [#f '()]))
     (define date-part
       (match (node-date-info nd)
         [(list d dline dcol)
          (list (datum->syntax #f '#:date (loc-vec src dline dcol 5))
                (datum->syntax #f d (loc-vec src dline dcol (string-length d))))]
         [#f '()]))
     (define done-part
       (match (node-done-info nd)
         [(list #t dline dcol)
          (list (datum->syntax #f '#:done (loc-vec src dline dcol 5)))]
         [(list d dline dcol)
          (list (datum->syntax #f '#:done (loc-vec src dline dcol 5))
                (datum->syntax #f d (loc-vec src dline dcol (string-length d))))]
         [#f '()]))
     (define desc-part
       (let ([ds (node-descs nd)])
         (if (null? ds)
             '()
             (let* ([texts (map car (reverse ds))]
                    [joined (string-join texts "\n")]
                    [first (last ds)]
                    [dline (cadr first)]
                    [dcol (caddr first)])
               (list (datum->syntax #f '#:description (loc-vec src dline dcol 1))
                     (datum->syntax #f joined
                                   (loc-vec src dline dcol (string-length joined))))))))
     (define kids (map node->syntax (reverse (node-children nd))))
     (define form
       (cons (datum->syntax #f 't (loc-vec src line col span))
             (append (list title-stx) id-part date-part done-part desc-part kids)))
     (datum->syntax #f form (loc-vec src line col span))]))

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
      (when (node-mirror? parent)
        (reader-error src (node-line nd) (node-col nd) #f
                      "mirror cannot have children"))
      (when (node-include? parent)
        (reader-error src (node-line nd) (node-col nd) #f
                      "include cannot have children"))
      (set-node-children! parent (cons nd (node-children parent))))
    (when (zero? level)
      (set! roots (cons nd roots)))
    (set! stack (append (take stack level) (list nd))))

  (define (require-task-parent! level n col what)
    (when (zero? level)
      (reader-error src n col #f "~a with no title above" what))
    (define parent (last-node-at (sub1 level)))
    (unless parent
      (reader-error src n col #f "~a with no title above" what))
    (when (node-mirror? parent)
      (reader-error src n col #f "~a cannot attach to a mirror" what))
    (when (node-include? parent)
      (reader-error src n col #f "~a cannot attach to an include" what))
    parent)

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
         [`(mirror ,anchor)
          (when (> level (current-depth))
            (reader-error src n col #f
                          "indent jumps more than one level (from ~a to ~a); use 2 spaces per level"
                          (current-depth) level))
          (when (and (zero? (current-depth)) (positive? level))
            (reader-error src n col #f
                          "indent jumps more than one level (from 0 to ~a); top-level tasks must start at column 0"
                          level))
          (when (and (positive? level)
                     (let ([p (last-node-at (sub1 level))])
                       (and p (or (node-mirror? p) (node-include? p)))))
            (reader-error src n col #f
                          (if (node-mirror? (last-node-at (sub1 level)))
                              "mirror cannot have children"
                              "include cannot have children")))
          (set! stack (take stack level))
          (define nd
            (node #f #f #f #f '() '() n col (string-length content) src anchor #f))
          (push-node! nd level)]
         [`(include ,path)
          (when (> level (current-depth))
            (reader-error src n col #f
                          "indent jumps more than one level (from ~a to ~a); use 2 spaces per level"
                          (current-depth) level))
          (when (and (zero? (current-depth)) (positive? level))
            (reader-error src n col #f
                          "indent jumps more than one level (from 0 to ~a); top-level tasks must start at column 0"
                          level))
          (when (and (positive? level)
                     (let ([p (last-node-at (sub1 level))])
                       (and p (or (node-mirror? p) (node-include? p)))))
            (reader-error src n col #f
                          (if (node-mirror? (last-node-at (sub1 level)))
                              "mirror cannot have children"
                              "include cannot have children")))
          (set! stack (take stack level))
          (define nd
            (node #f #f #f #f '() '() n col (string-length content) src #f path))
          (push-node! nd level)]
         [`(title ,title ,flag ,anchor)
          (when (> level (current-depth))
            (reader-error src n col #f
                          "indent jumps more than one level (from ~a to ~a); use 2 spaces per level"
                          (current-depth) level))
          (when (and (zero? (current-depth)) (positive? level))
            (reader-error src n col #f
                          "indent jumps more than one level (from 0 to ~a); top-level tasks must start at column 0"
                          level))
          (set! stack (take stack level))
          (define done-info
            (case flag
              [(done) (list #t n col)]
              [else #f]))
          (define id-info
            (and anchor (list anchor n col)))
          (define nd
            (node title #f done-info id-info '() '() n col (string-length title) src #f #f))
          (push-node! nd level)]
         [`(desc ,text)
          (define parent (require-task-parent! level n col "description line"))
          (set-node-descs! parent (cons (list text n col) (node-descs parent)))]
         [`(date ,d ,val-col)
          (define parent (require-task-parent! level n col "@date"))
          (when (node-date-info parent)
            (reader-error src n col #f
                          "duplicate @date on this task"))
          (set-node-date-info! parent (list d n val-col))]
         [`(done ,d ,val-col)
          (define parent (require-task-parent! level n col "@done"))
          (when (node-done-info parent)
            (reader-error src n col #f
                          "duplicate @done on this task"))
          (set-node-done-info! parent (list d n val-col))]
         [`(done-bare ,dcol)
          (define parent (require-task-parent! level n col "@done"))
          (when (node-done-info parent)
            (reader-error src n col #f
                          "duplicate @done on this task"))
          (set-node-done-info! parent (list #t n dcol))])]))
  (map node->syntax (reverse roots)))

(define (parse-outline-port src in)
  (parse-lines src (read-raw-lines src in)))

(define (parse-outline-string src str)
  (define in (open-input-string str))
  (port-count-lines! in)
  (parse-outline-port src in))
