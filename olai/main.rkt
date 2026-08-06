#lang racket/base

;; Public library surface: task data model, agenda query, web renderers.
;; CLI is app code, not re-exported here.

(require (except-in olai/lang/expander #%module-begin)
         (only-in olai/lang/walk find-task-by-id find-tasks-by-title)
         olai/agenda
         olai/index
         olai/web/render)

(provide task
         make-task
         task?
         task-title
         task-date
         task-description
         task-done
         task-status
         task-done-at
         task-id
         task-tags
         task-children
         task-file
         task-key
         mirror-ref
         mirror-ref?
         mirror-ref-anchor
         title-tags
         valid-anchor-id?
         find-task-by-id
         find-tasks-by-title
         validate-task-tree!
         (struct-out dated-task)
         collect-dated
         agenda-groups
         agenda-groups-from-files
         ;; node identity, inverted: key -> node, and the trail above it
         node-entry?
         node-entry-task
         node-entry-parent
         node-entry-file
         outline-index
         node-ancestors
         render-node-fragment
         render-outline
         render-breadcrumbs
         render-sidebar
         render-page
         render-zoom)
