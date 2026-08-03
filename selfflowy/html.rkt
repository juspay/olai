#lang racket/base

;; Render a task forest as interactive HTML via X-expressions (xml collection).

(require racket/list
         racket/string
         xml
         (except-in selfflowy/lang/expander #%module-begin))

(provide tasks->html
         task->xexpr
         page-xexpr)

(define (render-title-parts title)
  ;; Split title into text / tag runs for pill styling
  (define re #px"#[A-Za-z0-9_-]+")
  (define parts '())
  (define start 0)
  (let loop ([pos 0])
    (define m (regexp-match-positions re title pos))
    (cond
      [(not m)
       (when (< pos (string-length title))
         (set! parts (cons `(span ,(substring title pos)) parts)))
       (reverse parts)]
      [else
       (define a (caar m))
       (define b (cdar m))
       (when (> a pos)
         (set! parts (cons `(span ,(substring title pos a)) parts)))
       (set! parts
             (cons `(span ((class "inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-100 text-xs px-2 py-0.5 font-medium"))
                          ,(substring title a b))
                   parts))
       (loop b)])))

(define (task->xexpr tk)
  (define title (task-title tk))
  (define date (task-date tk))
  (define desc (task-description tk))
  (define kids (task-children tk))
  (define title-row
    `(div ((class "flex flex-wrap items-baseline gap-2"))
          (span ((class "text-base text-zinc-900 dark:text-zinc-100"))
                ,@(render-title-parts title))
          ,@(if date
                (list `(span ((class "text-xs rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 px-1.5 py-0.5 font-mono"))
                             ,date))
                '())))
  (define desc-el
    (if desc
        `((p ((class "mt-1 text-sm text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap"))
             ,desc))
        '()))
  (define body
    `(div ((class "py-1"))
          ,title-row
          ,@desc-el))
  (if (null? kids)
      `(li ((class "ml-1 list-none"))
           ,body)
      `(li ((class "ml-1 list-none"))
           (details ((open "open") (class "group"))
                    (summary ((class "cursor-pointer list-none"))
                             ,body)
                    (ul ((class "ml-4 border-l border-zinc-200 dark:border-zinc-700 pl-3 mt-1"))
                        ,@(map task->xexpr kids))))))

(define (page-xexpr tasks page-title)
  `(html ((lang "en"))
         (head
          (meta ((charset "utf-8")))
          (meta ((name "viewport") (content "width=device-width, initial-scale=1")))
          (title ,page-title)
          (script ((src "https://cdn.tailwindcss.com")))
          (script
           "tailwind.config = { darkMode: 'media' }"))
         (body ((class "bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen"))
               (main ((class "max-w-2xl mx-auto px-4 py-8"))
                     (header ((class "mb-6 flex items-center justify-between gap-4"))
                             (h1 ((class "text-xl font-semibold tracking-tight"))
                                 ,page-title)
                             (div ((class "flex gap-2 text-sm"))
                                  (button ((type "button")
                                           (id "expand-all")
                                           (class "px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"))
                                          "Expand all")
                                  (button ((type "button")
                                           (id "collapse-all")
                                           (class "px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"))
                                          "Collapse all")))
                     (ul ((class "space-y-1"))
                         ,@(map task->xexpr tasks))
                     (script
                      "document.getElementById('expand-all').onclick=()=>document.querySelectorAll('details').forEach(d=>d.open=true);"
                      "document.getElementById('collapse-all').onclick=()=>document.querySelectorAll('details').forEach(d=>d.open=false);")))))

(define (tasks->html tasks page-title)
  (string-append
   "<!DOCTYPE html>\n"
   (xexpr->string (page-xexpr tasks page-title))))
