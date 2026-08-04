#lang racket/base

;; Monthly Daily.rkt rollover: flat Daily/YYYY-MM.rkt fragments + @include.

(require racket/file
         racket/list
         racket/path
         racket/string
         racket/format
         selfflowy/dates
         selfflowy/edit
         selfflowy/lang/outline
         (except-in selfflowy/lang/expander #%module-begin)
         (only-in selfflowy/json-out count-tasks))

(provide month-name
         month-fragment-rel
         ensure-daily-day!
         migrate-monolithic-daily!)

(define month-names
  #("January" "February" "March" "April" "May" "June"
    "July" "August" "September" "October" "November" "December"))

(define (month-name m) ; 1..12
  (vector-ref month-names (sub1 m)))

(define (month-fragment-rel year month)
  (format "Daily/~a-~a.rkt"
          year
          (~r month #:min-width 2 #:pad-string "0")))

(define (parse-iso-day day)
  (unless (bare-iso-date-title? day)
    (error 'daily "expected YYYY-MM-DD, got ~s" day))
  (define y (string->number (substring day 0 4)))
  (define m (string->number (substring day 5 7)))
  (values y m))

(define (blank-line? s)
  (regexp-match? #px"^\\s*$" s))

(define (line-indent+content s)
  (define m (regexp-match #px"^( *)(.*)$" s))
  (values (string-length (cadr m)) (caddr m)))

(define (scan-title-line s)
  (cond
    [(blank-line? s) #f]
    [(regexp-match? #px"^#lang\\s" s) #f]
    [else
     (define-values (ind content) (line-indent+content s))
     (and (zero? (remainder ind 2))
          (not (regexp-match? #px"^:" content))
          (not (regexp-match? #px"^@" content))
          (not (regexp-match? #px"^\\*" content))
          (let* ([raw (if (regexp-match? #px"^\\\\" content)
                          (substring content 1)
                          content)]
                 [t0 (let-values ([(t _) (strip-checkbox-prefix raw)]) t)]
                 [t1 (let-values ([(t _) (strip-trailing-anchor t0)]) t)])
            (list ind t1)))]))

(define (find-title-line lines title indent)
  (for/or ([i (in-range (length lines))])
    (define info (scan-title-line (list-ref lines i)))
    (and info
         (= (car info) indent)
         (equal? (cadr info) title)
         i)))

(define (section-end lines parent-idx parent-indent)
  (define child-indent (+ parent-indent 2))
  (let loop ([i (add1 parent-idx)])
    (cond
      [(>= i (length lines)) i]
      [(blank-line? (list-ref lines i)) (loop (add1 i))]
      [else
       (define info (scan-title-line (list-ref lines i)))
       (cond
         [(not info)
          (define-values (ind _) (line-indent+content (list-ref lines i)))
          (if (< ind child-indent) i (loop (add1 i)))]
         [(< (car info) child-indent) i]
         [else (loop (add1 i))])])))

(define (lines->text lines original)
  (define body (string-join lines "\n"))
  (if (regexp-match? #px"\n$" original)
      (if (regexp-match? #px"\n$" body) body (string-append body "\n"))
      body))

(define (write-validated path text)
  (apply-outline-edit! path text))

(define (make-parent-directory* path)
  (define-values (base name dir?) (split-path path))
  (when (path? base)
    (make-directory* base)))

(define (ensure-file-lang path)
  (unless (file-exists? path)
    (make-parent-directory* path)
    (display-to-file "#lang selfflowy\n" path #:exists 'error)))

;; Ensure day node exists. Returns hash of result fields (no version/ok).
(define (ensure-daily-day! home day)
  (define-values (y m) (parse-iso-day day))
  (define home-path (simple-form-path (expand-user-path home)))
  (define root (build-path home-path "Daily.rkt"))
  (define rel (month-fragment-rel y m))
  (define frag (build-path home-path rel))
  (define year-title (number->string y))
  (define mon-title (month-name m))

  (ensure-file-lang root)
  (define created-month? #f)
  (define created-day? #f)

  (unless (file-exists? frag)
    (set! created-month? #t)
    (make-parent-directory* frag)
    (display-to-file "#lang selfflowy\n" frag #:exists 'error))

  (define frag-text (file->string frag))
  (define frag-lines (string-split frag-text "\n" #:trim? #f))
  (define day-idx (find-title-line frag-lines day 0))
  (define day-line
    (cond
      [day-idx (add1 day-idx)]
      [else
       (set! created-day? #t)
       (define after-lang
         (for/or ([i (in-range (length frag-lines))])
           (and (regexp-match? #px"^#lang\\s" (list-ref frag-lines i))
                (add1 i))))
       (define at (or after-lang (length frag-lines)))
       (define new-lines
         (append (take frag-lines at)
                 (list day)
                 (drop frag-lines at)))
       (define new-text (lines->text new-lines frag-text))
       (write-validated frag new-text)
       (add1 at)]))

  (define root-text (file->string root))
  (unless (regexp-match? #px"(?m:^#lang selfflowy)" root-text)
    (error 'daily "Daily.rkt must be #lang selfflowy"))
  (define root-lines (string-split root-text "\n" #:trim? #f))

  (define root-lines*
    (if (find-title-line root-lines year-title 0)
        root-lines
        (append root-lines
                (if (or (null? root-lines)
                        (blank-line? (last root-lines)))
                    (list year-title)
                    (list "" year-title)))))

  (define year-i (find-title-line root-lines* year-title 0))
  (unless year-i (error 'daily "internal: year node missing"))

  (define mon-i
    (let ([end (section-end root-lines* year-i 0)])
      (for/or ([i (in-range (add1 year-i) end)])
        (define info (scan-title-line (list-ref root-lines* i)))
        (and info (= (car info) 2) (equal? (cadr info) mon-title) i))))

  (define root-lines**
    (if mon-i
        root-lines*
        (let ([end (section-end root-lines* year-i 0)])
          (append (take root-lines* end)
                  (list (string-append "  " mon-title))
                  (drop root-lines* end)))))

  (define mon-i*
    (or mon-i
        (for/or ([i (in-range (length root-lines**))])
          (define info (scan-title-line (list-ref root-lines** i)))
          (and info (= (car info) 2) (equal? (cadr info) mon-title) i))))
  (unless mon-i* (error 'daily "internal: month node missing"))

  (define include-line (string-append "    @include " rel))
  (define has-include?
    (let ([end (section-end root-lines** mon-i* 2)])
      (for/or ([i (in-range (add1 mon-i*) end)])
        (regexp-match?
         (pregexp (string-append "^\\s*@include\\s+" (regexp-quote rel) "\\s*$"))
         (list-ref root-lines** i)))))

  (define added-include? #f)
  (define root-lines***
    (if has-include?
        root-lines**
        (let ([end (section-end root-lines** mon-i* 2)])
          (set! added-include? #t)
          (append (take root-lines** end)
                  (list include-line)
                  (drop root-lines** end)))))

  (define root-text* (lines->text root-lines*** root-text))
  (unless (equal? root-text* root-text)
    (write-validated root root-text*))

  (hash 'day day
        'file (path->string (simple-form-path frag))
        'created_month (or created-month? added-include?)
        'created_day created-day?
        'line day-line))

;; Migrate monolithic Daily.rkt (year>month>days) into Daily/YYYY-MM.rkt.
;; Returns (list task-count-before task-count-after).
(define (migrate-monolithic-daily! home)
  (define home-path (simple-form-path (expand-user-path home)))
  (define root (build-path home-path "Daily.rkt"))
  (unless (file-exists? root)
    (error 'migrate "no Daily.rkt at ~a" root))
  (define n-before
    (count-tasks (dynamic-require `(file ,(path->string root)) 'tasks)))

  (define text (file->string root))
  (define lines (string-split text "\n" #:trim? #f))

  (define result (make-hash)) ; key -> list of day line-groups
  (define current-year #f)
  (define current-month #f)
  (define current-day #f)
  (define day-buf '())

  (define (flush-day!)
    (when (and current-year current-month current-day (pair? day-buf))
      (define key
        (format "~a-~a" current-year
                (~r current-month #:min-width 2 #:pad-string "0")))
      (hash-update! result key
                    (λ (xs) (append xs (list (reverse day-buf))))
                    '()))
    (set! day-buf '())
    (set! current-day #f))

  (for ([s (in-list lines)])
    (define info (scan-title-line s))
    (cond
      [(and info (zero? (car info)) (regexp-match? #px"^[0-9]{4}$" (cadr info)))
       (flush-day!)
       (set! current-year (string->number (cadr info)))
       (set! current-month #f)]
      [(and info (= (car info) 2) current-year)
       (flush-day!)
       (define m
         (for/or ([i (in-range 1 13)])
           (and (equal? (month-name i) (cadr info)) i)))
       (set! current-month m)]
      [(and info (= (car info) 4) current-year current-month
            (bare-iso-date-title? (cadr info)))
       (flush-day!)
       (set! current-day (cadr info))
       (set! day-buf (list (cadr info)))]
      [(and current-day info)
       (define-values (ind content) (line-indent+content s))
       (define new-ind (max 0 (- ind 4)))
       (set! day-buf
             (cons (string-append (make-string new-ind #\space) content)
                   day-buf))]
      [(and current-day (not info) (not (blank-line? s)))
       (define-values (ind content) (line-indent+content s))
       (define new-ind (max 0 (- ind 4)))
       (set! day-buf
             (cons (string-append (make-string new-ind #\space) content)
                   day-buf))]
      [(and current-day (blank-line? s))
       (set! day-buf (cons "" day-buf))]
      [else (void)]))
  (flush-day!)

  (when (hash-empty? result)
    (error 'migrate "no year/month/day structure found to migrate"))

  (for ([(key day-groups) (in-hash result)])
    (define rel (string-append "Daily/" key ".rkt"))
    (define frag (build-path home-path rel))
    (make-parent-directory* frag)
    (define body
      (string-append
       "#lang selfflowy\n\n"
       (string-join
        (for/list ([g (in-list day-groups)])
          (string-join g "\n"))
        "\n\n")
       "\n"))
    (display-to-file body frag #:exists 'truncate/replace)
    (dynamic-require `(file ,(path->string frag)) 'tasks))

  (define header-lines
    (let loop ([i 0] [acc '()])
      (cond
        [(>= i (length lines)) (reverse acc)]
        [else
         (define s (list-ref lines i))
         (define info (scan-title-line s))
         (cond
           [(and info (zero? (car info)) (regexp-match? #px"^[0-9]{4}$" (cadr info)))
            (reverse acc)]
           [else (loop (add1 i) (cons s acc))])])))

  (define years
    (sort (remove-duplicates
           (for/list ([k (in-hash-keys result)])
             (substring k 0 4)))
          string<?))

  (define body-lines
    (append*
     (for/list ([y (in-list years)])
       (define months
         (sort
          (for/list ([k (in-hash-keys result)]
                     #:when (string-prefix? k (string-append y "-")))
            (string->number (substring k 5 7)))
          <))
       (cons y
             (append*
              (for/list ([m (in-list months)])
                (list (string-append "  " (month-name m))
                      (string-append "    @include "
                                     (month-fragment-rel (string->number y) m)))))))))

  (define hdr
    (if (and (pair? header-lines) (blank-line? (last header-lines)))
        header-lines
        (append header-lines (list ""))))
  (define new-root
    (string-append (string-join hdr "\n")
                   (string-join body-lines "\n")
                   "\n"))
  (write-validated root new-root)

  (define n-after
    (count-tasks (dynamic-require `(file ,(path->string root)) 'tasks)))
  (list n-before n-after))
