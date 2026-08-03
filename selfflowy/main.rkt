#lang racket/base

;; Public library surface: task data model, tree rendering, agenda query.
;; CLI lives in selfflowy/cli and is not re-exported here.

(require (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/tree
         selfflowy/agenda)

(provide task
         task?
         task-title
         task-date
         task-description
         task-children
         render-tree
         (struct-out dated-task)
         collect-dated
         agenda-groups)
