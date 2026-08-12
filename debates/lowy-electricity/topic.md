# Debate: the electricity receptacle — what in olai deserves one?

**The charter (the human's):** all three debaters argue **FOR** volatility-based extraction in olai — as a package or as a module. The electricity analogy in particular is what we are looking for: enormous supply-side volatility encapsulated behind an opaque, stable socket, the way a receptacle hides AC/DC, voltage, phase, frequency, and source from every appliance. **Kolu's surface framework came out of exactly this thinking** — the wire's volatility (sockets, reconnects, stale tabs, heartbeats, frame shapes) behind `defineSurface`, extracted at ONE consumer and aged into a framework. Find olai's next receptacle.

**Mode:** three debaters, three altitudes (below), each arguing FOR extraction at their altitude. Steelman duty across altitudes. End-state: CONVERGE — the debate ends in a ratified ledger of receptacle extractions (conclusion.md).

## Grounding sources (read before your opening turn)

- **The article, in FULL:** Juval Löwy, "Volatility-Based Decomposition" (Righting Software ch. 2 excerpt), https://www.informit.com/articles/article.aspx?p=2995357&seqNum=2 — a plain-text extraction is at `/home/srid/code/olai/.worktrees/lowy-article.txt` (grounding copy only; NEVER commit it or quote it at length in committed files — cite section names and short phrases). Internalize its tests before arguing:
  1. **The receptacle test** — the consumer sees an opaque socket; ALL supply-side churn is invisible behind it.
  2. **"Functional but not domain-functional"** — electricity IS functionality, but not the house's domain. What in olai is real functionality that is not about outlines/notes/days?
  3. **The oscilloscope test** — what does consuming X in olai require a consumer to know today that a receptacle would hide? (The house without the receptacle: expose wires, measure with an oscilloscope, certify with a voltmeter.)
  4. **The vault test** — where does a change-grenade throw shrapnel across module boundaries today?
- `docs/architecture.md` — the layering, and the `@kolu/surface` / `serveSurfaceApp` "paid upstream" precedents.
- `debates/kitchen-sinks/conclusion.md` — the PRIOR debate. Its **factual corrections stand** (do not re-litigate falsified citations; items already shipped: #125's interpret.ts). Its "zero new packages" VERDICT is **not binding here**: that debate asked "does the survey survive the bar?"; this one asks "what does the bar, argued affirmatively, demand?" Where the electricity analogy genuinely applies, this debate may overturn it — but you must engage its arguments by name, especially "isolation selects for stability" and "a receptacle you plan to delete is not a receptacle."
- The code. Cite `file:line`; a claim that does not survive a read is conceded.

## Stances — three altitudes, all FOR extraction

- **fable** (Claude): the **package** altitude. What is olai's next `@kolu/surface` — the receptacle worth a manifest, maybe worth its own repo? Argue reuse as the article does: a *consequence* of encapsulation ("using power in one house indistinguishable from another"), never a precondition.
- **opencode**: the **module** altitude. The strongest case that olai's receptacles belong INSIDE packages — sockets without manifests: one file whose interface is the receptacle, everything behind it free to churn. Argue why the module socket delivers the vault without the manifest tax, and name the modules.
- **grok**: the **upstream/graduation** altitude. What should be PAID INTO KOLU (the precedents: `serveSurfaceApp` took the listener sequence, `precompress-upstream` will take compression, surface itself took the wire) or extracted as a repo-transcending leaf? Argue the receptacle whose consumers are every kolu-surface app, not just olai.

Each stance must ALSO name the strongest candidate at the other two altitudes it would sign — the convergence is a ledger across altitudes, not a winner-take-all.

## Rules of conduct

- Steelman before rebutting; concede what is genuinely true; forge new insight.
- Every candidate must pass all four tests above EXPLICITLY — name the supply-side volatility litany (the AC/DC/voltage/phase equivalent), the opaque socket, the domain test, and today's shrapnel path.
- Each turn is the next file `debates/lowy-electricity/<NN>.<your-id>.md`. Write ONLY your own turn files. Never edit another debater's file or anything else in the repository. Never run a git command that writes; the orchestrator owns the repository.
- Round 1: openings from the grounding alone. Round k>1: read the other two debaters' round k−1 files first, then reply — engage by name.
