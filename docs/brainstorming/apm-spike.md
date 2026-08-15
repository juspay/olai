# APM as agent launcher — spike report

Scratch directory only. No production code. No commits to any repo. Date: 2026-08-13. APM exercised: **0.28.0** (`3aa0365`) from a shallow clone of `microsoft/apm` at `apm-src/`. Docs: https://microsoft.github.io/apm — specifically [Runtime compatibility](https://microsoft.github.io/apm/integrations/runtime-compatibility/), [`apm runtime`](https://microsoft.github.io/apm/reference/cli/runtime/), [`apm run`](https://microsoft.github.io/apm/reference/cli/run/), [Run scripts](https://microsoft.github.io/apm/consumer/run-scripts/), [Primitives and targets](https://microsoft.github.io/apm/concepts/primitives-and-targets/).

**Bottom line up front:** Ranked options for "APM as our launcher":

1. **Native Kolu argv** (`kolu create -- claude`) — only path that keeps Kolu agent detection (`claude · waiting` / `working`) so `kolu wait --until …` and `kolu debrief` work.
2. **APM install/compile only** — right product, wrong question (context, not launch).
3. **Option 4 — `apm run` npm-scripts** — TUI boots, flags take, prompt compiler works. **Kolu AGENT column is blinded** (`foreground=python`, `agent=null`). Orchestrator cannot babysit the lane. Major cost, measured.
4. **First-class APM runtimes** — fights Kolu (Codex forced to `exec`, adapters pipe stdio).
5. **`llm` + `llm-grok`** — grok-the-model, not an agent.

Do not put `apm run` on a Kolu terminal argv. Do not wait on a Claude/Grok *runtime* PR.

---

## 0. Two planes that must not be collapsed

APM uses "runtime" for two different things. The question ("could APM be our agent launcher?") is about plane 2. Official positioning is plane 1.

| Plane | What it is | Commands | Grok? | Claude Code? |
|---|---|---|---|---|
| **Install / compile / targets** | Package manager for agent *context*. Writes harness-native files, then the process exits. Docs: "Not a runtime. APM has no runtime footprint." | `apm install`, `apm compile` | **Yes as a target.** First-class `grok-build` → `.grok/` + `AGENTS.md`. Experimental `grok-cloud` (PR #2420, skills only, `apm experimental enable grok-cloud`). | **Yes as a target.** `claude` → `.claude/` |
| **Launch / `apm runtime` + `apm run`** | Experimental installer + script runner for a **fixed list of four AI CLIs**. Docs: "think `npx` for AI runtime CLIs." Marked experimental. | `apm runtime setup {copilot,codex,gemini,llm}`, `apm run <script>` | **No.** | **No.** |

The four *launch* runtimes, preference order `copilot -> codex -> gemini -> llm`:

1. GitHub Copilot CLI (`@github/copilot`)
2. OpenAI Codex CLI (GitHub-release tarball, defaulted to GitHub Models)
3. Google Gemini CLI (`@google/gemini-cli`)
4. Simon Willison's `llm` (managed venv; default plugin `llm-github-models`)

Claude and Grok are first-class **targets** and **not** launch runtimes. The run-scripts doc *mentions* `claude` as a script-body example the same way it mentions `cursor-agent` / `opencode`: "any runtime CLI you have on PATH." That is the generic shell path, not the registry.

---

## 1. How a launch actually works

### 1.1 The command

```bash
apm run                 # runs scripts.start, or errors listing scripts
apm run <name>          # named scripts: entry
apm run <name> --param key=value   # interpolates into .prompt.md, not the env
apm preview <name>      # compile + print rewritten argv; do not execute
```

There is **no** `--runtime` flag on `apm run` in 0.28.0. The stale hint `apm run start --runtime=llm` is still printed by `scripts/runtime/setup-llm.sh`. The runtime is whichever binary the **script string** names.

### 1.2 What config declares runtime / model / params

**Runtime is not a first-class field.** It is a literal shell command in `apm.yml`:

```yaml
scripts:
  start: "copilot --allow-all-tools -p hello-world.prompt.md"
  codex: "codex --skip-git-repo-check hello-world.prompt.md"
  llm:   "llm hello-world.prompt.md -m github/gpt-4o-mini"
  gemini: "gemini -y -p hello-world.prompt.md"
```

- Object-form scripts (`description:`, `env:`) are **not** supported.
- **Model** lives in that string (`-m …`) or in the child CLI's own config (`~/.codex/config.toml`, Copilot login, `llm keys`, Gemini login).
- **Params** are `--param key=value` on `apm run`. They fill `${input:key}` in `.prompt.md`. They are **not** exported as environment variables. There is no `--` passthrough of extra argv.

`apm runtime setup <name>` is a **binary installer**, not per-project launch config. It writes `~/.apm/runtimes/<name>` and (except `--vanilla`) may rewrite the child's *global* config. For Codex that rewrite is `cat > ~/.codex/config.toml` — **destructive** to an existing ChatGPT-auth install (this machine's).

### 1.3 Execution path (source of truth: `src/apm_cli/core/script_runner.py`)

1. Load `apm.yml`. Look up `scripts[name]`. If missing, auto-discover a `.prompt.md` and synthesize a command for the first installed runtime in preference order.
2. Find every `\S+\.prompt.md` token. Compile (parameter substitution) to `.apm/compiled/<name>.txt`.
3. If the command names a **registered** runtime (`copilot|codex|gemini|llm`):
   - Strip the filename.
   - Later pass the **compiled prompt text as a CLI argument** (not a file path).
   - Codex is **forced** onto `codex exec` by `_build_codex_command`, even if the script said `codex` with no subcommand.
   - If the script already said `codex exec`, preview produces the broken `codex exec exec …`. Confirmed live.
4. Inject `GITHUB_TOKEN` / `GITHUB_APM_PAT` via `setup_runtime_environment`.
5. Resolve the binary: **`~/.apm/runtimes/<name>` first**, then `PATH`.
6. `subprocess.run(argv, check=True, env=…)` — **stdio inherited, no PTY, no timeout**.
7. Print success/error. APM does **not** `execve`-replace itself. It is always a parent.

Non-registered binaries (`grok`, `claude`, `pytest`, …) take the other branch: substitute the compiled **file path** into the string, then `subprocess.run(command, shell=True)`.

### 1.4 Interactive TTY vs APM's own loop

Two launch surfaces exist. They are not the same.

| Surface | Who uses it | Child invocation | TTY? | Deadline |
|---|---|---|---|---|
| **`apm run` script runner** | Humans / CI / "npx for AI CLIs" | Your script argv, with the rewrite above | **Inherits parent stdio.** No `pty.openpty`. If the parent is a real terminal, the child *sees* a TTY. | None |
| **`RuntimeAdapter.execute_prompt`** | Programmatic / workflow adapters | Copilot: `copilot -p <text>` (600s). Codex: **`codex exec --skip-git-repo-check <text>`** (300s). LLM: `llm [-m model] <text>`. Gemini: **no adapter**. | **Piped stdout/stderr**, streamed by APM. `start_new_session=True`. Not a TTY. | Yes |

So:

- `apm run` *inside* a Kolu terminal can host an interactive CLI **only if** the script does not trip the `.prompt.md` rewrite (or the rewrite still produces an interactive argv). For Codex, the rewrite **always** produces `codex exec` — batch, not the TUI.
- The adapter / workflow path is APM's own execution loop: pipe, stream, wall-clock kill, reap process group. That path is **not** Kolu-compatible.
- APM never `exec`s. Kolu's process identity is `apm`, not `grok`/`claude`/`codex`. Screen text, wait-until-awaiting, and argv inspection all see the wrapper.

Gemini has a setup script and a registry entry, but **no** `RuntimeAdapter`. Claude and Grok have target adapters (file deploy) and **no** launch-runtime entries.

### 1.5 Installing the APM CLI on this machine

Official `curl https://aka.ms/apm-unix | sh` fetched `apm-linux-x86_64.tar.gz` v0.28.0. The PyInstaller binary failed on NixOS: `libffi.so.8`, then `libsqlite3.so.0` / `libz.so.1`. No system `python3`.

Working path: Nix `python312` + `uv sync` of the clone into `./.venv`. Wrapper: `./apm`.

`apm doctor`: git ok, github.com reachable, **"Token detected"** from `gh` keyring (account `srid`, scopes `gist,read:org,repo,workflow` — **no Models scope**). Env: `GITHUB_TOKEN`, `GITHUB_APM_PAT`, `OPENAI_API_KEY`, `XAI_API_KEY` all unset.

---

## 2. SPIKE CODEX

### 2.1 Why we did **not** run `apm runtime setup codex`

- System Codex already on PATH: `codex-cli 0.146.0` at `~/.local/bin/codex`.
- `apm runtime list` already marks `codex` installed. `apm runtime status` reports **active runtime: codex**.
- `~/.codex/auth.json` is `auth_mode=chatgpt` with refresh tokens. `OPENAI_API_KEY` is null. This is a working ChatGPT-login Codex, not GitHub Models.
- `scripts/runtime/setup-codex.sh` **unconditionally overwrites** `~/.codex/config.toml` with:

  ```toml
  model_provider = "github-models"
  model = "openai/gpt-4o"
  [model_providers.github-models]
  base_url = "https://models.github.ai/inference/"
  env_key = "GITHUB_TOKEN"
  wire_api = "responses"
  ```

  That would smash this machine's ChatGPT-auth config. Spike rule: document the wall, do not acquire or destroy credentials.
- Setup would also download **`rust-v0.118.0`** into `~/.apm/runtimes/codex`. `find_runtime_binary` would then **prefer that pin over** the system 0.146.0.
- Docs warn Codex ≥ v0.116 defaults to `wire_api=responses`, which GitHub Models does not expose (404). APM's own default config still writes `wire_api = "responses"`.

### 2.2 Minimal project

`spike-codex/`, created with `apm init spike-codex -y --target codex`.

```yaml
targets: [codex]
scripts:
  start: "codex --skip-git-repo-check --sandbox read-only --ephemeral spike.prompt.md"
  chatgpt: "codex --skip-git-repo-check --sandbox read-only --ephemeral -m gpt-5.2 spike.prompt.md"
```

Prompt asks for the single line `APM-CODEX-SPIKE-OK token=${input:token}` and forbids tools.

### 2.3 What actually ran

`apm preview start --param token=spike13` rewrote:

```
original:  codex --skip-git-repo-check --sandbox read-only --ephemeral spike.prompt.md
compiled:  codex exec --skip-git-repo-check --sandbox read-only --ephemeral
```

(prompt text appended as a positional argv at exec time.)

An earlier preview of a script that already contained `codex exec` produced `codex exec exec …`. The official `apm run` docs currently show that broken form.

`apm run start --param token=spike13` **did launch Codex**. Observed:

- APM compiled the prompt, printed a 225-character preview, spawned `codex exec …`.
- Child inherited stdio. Codex printed `Reading additional input from stdin...` even with `</dev/null` (non-TTY stdin).
- Codex 0.146.0 started, picked `model: gpt-5.6-sol` / `provider: openai` from `~/.codex/config.toml`, session id allocated, prompt delivered.
- Sandbox warning: no host `bubblewrap`; used bundled.
- **Wall (exact):**

  ```
  ERROR: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.6-sol' model is not supported when using Codex with a ChatGPT account."}}
  Script execution failed with exit code 1
  ```

Retry with `-m gpt-5.2` (script `chatgpt`) and a direct `codex exec -m gpt-5.1-codex` hit the **same 400**, same wording, for each model. This ChatGPT-auth Codex session will talk to the API far enough to reject the model; it will not complete a generation. That is an account/plan wall, not a missing `GITHUB_TOKEN` wall, and not an APM spawn failure.

**Launch mechanics: proven. Token for GitHub Models: not present and not needed for this path. Completion: blocked by ChatGPT-account model support.**

---

## 3. SPIKE GROK

### 3.1 Hypothesis

Grok is not an APM **runtime**. `llm` *is*. `llm-grok` exists (Benedikt Hiepler, PyPI `llm-grok` 1.4.2) and talks to the xAI API. Therefore grok-the-**model** may already be launchable through APM's `llm` runtime.

Separately, grok-the-**agent-CLI** (`grok` 1.0.4 on PATH) is a **target** (`grok-build`), not a runtime. `apm run` will not special-case it.

PR #2420 / issue #2419 added experimental **`grok-cloud` as a TARGET** (skills → `.grok/skills/`), not a launcher.

### 3.2 Test — grok-the-model via `llm`

Confirmed.

- `apm-cli` itself depends on `llm==0.31` plus `llm-github-models`.
- `pip install llm-grok==1.4.2` into the spike venv registered:

  `grok-4-latest`, `grok-4-fast`, `grok-4-1-fast`, `grok-code-fast-1`, `grok-3-latest`, … plus GitHub Models `github/grok-3`.
- `llm-grok` key: name `grok`, env `XAI_API_KEY`.
- `llm-github-models` key: name `github`, env `GITHUB_MODELS_KEY` or `GITHUB_TOKEN`.

`spike-grok/` scripts:

```yaml
scripts:
  llm-grok:        "llm spike.prompt.md -m grok-4-latest"
  llm-github-grok: "llm spike.prompt.md -m github/grok-3"
  grok-cli:        "grok --prompt-file spike.prompt.md"
```

`apm preview llm-grok` rewrote `llm spike.prompt.md -m grok-4-latest` → `llm -m grok-4-latest` (content appended).

`apm run llm-grok` — **exact wall:**

```
Error: No key found - add one using 'llm keys set grok' or set the XAI_API_KEY environment variable
```

`apm run llm-github-grok` — **exact wall:**

```
Error: No key found - add one using 'llm keys set github' or set the GITHUB_MODELS_KEY or GITHUB_TOKEN environment variables
```

Hypothesis holds at the wiring layer. The only missing piece is a key we did not acquire.

This path is **grok-the-model**, not grok-the-agent. `llm` is a single-shot completion CLI. It has no Kolu-shaped TUI, no ACP session, no sandbox, no skills/hooks loop. It is not a substitute for `grok` as a lane process.

### 3.3 Test — grok-the-CLI via APM's generic script path

`grok` is not in `runtime_names()`, so APM takes the file-path + `shell=True` branch.

First attempt used a hallucinated `--print` flag (Claude's). Clap error: `a value is required for '--single <PROMPT>'`. Real headless flags are `-p`/`--single <PROMPT>` and `--prompt-file <PATH>`.

Corrected script: `grok --prompt-file spike.prompt.md` → compiled `grok --prompt-file .apm/compiled/spike.txt`.

**`apm run grok-cli` succeeded in 2.48s and printed `APM-GROK-LLM-OK`.** Grok on this machine is already authenticated. APM can therefore *shell out* to the grok CLI as a generic script. That is not first-class runtime support; it is npm-scripts-with-a-prompt-compiler.

### 3.4 Official `apm runtime setup llm`

Ran `apm runtime setup llm --vanilla` inside `nix-shell` (needs `python3` on PATH). It:

1. Created `~/.apm/runtimes/llm-venv` and installed `llm==0.32`.
2. Wrote wrapper `~/.apm/runtimes/llm` with `#!/bin/bash`.
3. **Failed** at `ensure_path_updated`: `echo >> ~/.bashrc` → **Permission denied**. `~/.bashrc` was not modified (mtime unchanged).
4. The wrapper is **not executable on this NixOS host**: `/bin/bash: bad interpreter: No such file or directory`. Bash lives at `/etc/profiles/per-user/srid/bin/bash`.
5. `apm runtime list` still reports `llm` **Installed** (it only checks that the file exists). Version: `unknown`.
6. Calling `~/.apm/runtimes/llm-venv/bin/llm` directly works. After `pip install llm-grok` into that venv, same `XAI_API_KEY` wall as above.

`apm runtime setup` is not isolated to the scratch directory. It writes `$HOME/.apm/runtimes` and tries to mutate the user's shell rc. Codex setup would also overwrite `$HOME/.codex/config.toml`.

### 3.5 First-class `grok` runtime — what it would take

Mirror the four existing implementations. Canonical registry: `src/apm_cli/runtime/registry.py` → `RUNTIME_DESCRIPTORS`.

| Piece | Where | What grok would add |
|---|---|---|
| `RuntimeDescriptor` | `runtime/registry.py` | `name="grok"`, `binary="grok"`, `preference` (after gemini? before llm?), `setup_script="setup-grok"`, `script_builder="_build_grok_command"`, `content_argument="prompt_flag"` (`-p`/`--single`) **or** a file-flag variant (`--prompt-file`) |
| `RuntimeAdapter` (optional) | `runtime/grok_runtime.py` | Gemini proves this is optional. Copilot/Codex/LLM implement `execute_prompt` / `is_available` / `get_runtime_info`. For grok: `["grok", "--prompt-file", …]` or `["grok", "-p", prompt_content]`, no fixed deadline (llm-style) or a long one (copilot-style). |
| Setup script | `scripts/runtime/setup-grok.sh` (+ `.ps1`) | The other four either `npm i -g` (copilot, gemini), download a GitHub release (codex), or `python3 -m venv && pip install` (llm). Grok Build is a self-updating binary (`~/.grok/bin/grok`). A setup script would either refuse and tell the user to install Grok Build, or fetch whatever xAI publishes. |
| `RuntimeManager` | already table-driven | No code if the descriptor + setup script exist. |
| CLI choices | `commands/runtime.py` uses `runtime_names()` | Free. |
| Script builder | `script_runner.py` | `_build_grok_command`: strip `--prompt-file` / `-p` the way copilot strips `-p`, leave other flags. Decide whether to force `grok agent` / headless the way Codex is forced onto `exec`. **Do not force headless if the point is Kolu TUI.** |
| Docs | `docs/.../runtime-compatibility.md`, `reference/cli/runtime.md` | Add the fifth row. |
| Tests | `tests/unit` + `requires_runtime_*` markers | Same shape as copilot/codex/llm. |

Existing **target** work that is *not* this:

- `integration/targets.py` `grok-build` / `grok-cloud` profiles (file deploy).
- `adapters/client/` has **no** grok MCP adapter (`MCP servers / grok-build = unsupported` in the matrix).
- `ClaudeClientAdapter` is an MCP *config writer*, not a launcher. Same confusion trap for a future `GrokClientAdapter`.

Cheapest *useful* grok-runtime is Gemini-sized (descriptor + builder + docs, no adapter, no setup — "binary must be on PATH"). Cheapest *correct* Kolu-shaped grok-runtime is even smaller: **don't add one**, and keep using the generic script path (already proven) or skip `apm run` entirely.

---

## 4. How the four existing runtimes are implemented

| Name | Pref | Binary | Setup | `RuntimeAdapter` | Prompt argv | Default generated command |
|---|---|---|---|---|---|---|
| copilot | 10 | `copilot` | `setup-copilot.sh` — npm `@github/copilot`, Node ≥ 22 | `copilot_runtime.py` | `-p <content>` | `copilot --log-level all --log-dir copilot-logs --allow-all-tools -p {prompt_file}` |
| codex | 20 | `codex` | `setup-codex.sh` — GitHub release tarball + SHA-256, default GitHub Models | `codex_runtime.py` | positional `<content>` | `codex -s workspace-write --skip-git-repo-check {prompt_file}` (builder then forces `exec`) |
| gemini | 30 | `gemini` | `setup-gemini.sh` — npm `@google/gemini-cli`, Node ≥ 20 | **none** | `-p <content>` | `gemini -p {prompt_file}` |
| llm | 40 | `llm` | `setup-llm.sh` — venv + `pip install llm [llm-github-models]` | `llm_runtime.py` | positional `<content>` | builder keeps `-m …` |

Shared machinery: `RuntimeAdapter` (`runtime/base.py`) → setup scripts (`scripts/runtime/`) → `RuntimeManager` (`runtime/manager.py`) → script-runner builders → `commands/runtime.py`.

`src/apm_cli/adapters/client/*` are **MCP/config writers for the install plane**, not launchers.

---

## 5. Verdict

### 5.1 What Claude Code runtime support would take upstream

Small, well-marked, and **not required** for Claude to already work as a script.

Today, official run docs show:

```yaml
scripts:
  claude: "claude -p hello-world.prompt.md"
```

Because `claude` is **not** in `runtime_names()`, APM compiles the prompt and substitutes the **file path**: `claude -p .apm/compiled/hello-world.txt`, then `shell=True`. That already launches Claude Code. Claude is also a first-class **target** (`.claude/`, MCP to `.mcp.json`). The missing piece is only first-class *runtime* membership.

To add it properly (Gemini-sized, the honest minimum):

1. `RuntimeDescriptor(name="claude", binary="claude", setup_script="setup-claude", script_builder="_build_claude_command", content_argument="prompt_flag")`.
2. `_build_claude_command` — strip `-p`/`--print`, keep other flags. Decide whether to force `--print`/`-p` (batch) the way Codex is forced onto `exec`. Forcing batch would fight Kolu; not forcing it leaves interactive `claude` intact.
3. Optional `claude_runtime.py`: `execute_prompt` → `claude -p <text>` (Claude's non-interactive flag), timeout like Copilot (600s) or none.
4. `scripts/runtime/setup-claude.sh` — either "binary must be on PATH" (claude is already a native installer) or wrap Anthropic's official install. There is no APM-owned Claude binary today.
5. Docs + tests.

Political/product note: APM's launch plane is GitHub-Models-centric (Copilot first, Codex defaulted to `models.github.ai`, llm defaulted to `llm-github-models`). Claude as a *target* was added because the package-manager promise is "one manifest, every harness." Claude as a *runtime* would mean APM also *installs and prefers* a non-Microsoft CLI. That is why the four-runtime list looks the way it does.

Estimate: a focused PR, Gemini-shaped, a few hundred lines plus tests. Not a redesign. Not worth doing for Kolu, because Kolu already has `claude` on PATH.

### 5.2 Does APM-as-launcher fit the Kolu-terminal lane model, or fight it?

Kolu lanes spawn a real PTY with an argv (`grok`, `claude`, `codex`). The orchestrator inspects that process, reads the screen, waits until awaiting, kills by pid. The child *is* the agent.

**Fit (narrow):**

- APM's **install/compile** plane is exactly "write the files the harness already reads." `grok-build` → `.grok/` + `AGENTS.md`. `claude` → `.claude/`. `codex` → `.codex/` + `AGENTS.md`. Kolu then launches the native binary. Planes do not overlap. This is the design APM's own manifesto argues for.
- A generic `scripts:` entry with **no** `.prompt.md` (e.g. `start: "grok"`) is just `subprocess.run(..., shell=True)` with inherited stdio. That *can* sit on a Kolu argv. It adds nothing Kolu does not already do.

**Fight (the actual launcher):**

1. **`apm run` is a wrapper, not an `exec`.** Kolu's process is `apm`, not the agent. Preference order, compile, env injection, success banners all sit in front of the TUI.
2. **Codex is forced to `codex exec`.** The happy path for the one runtime we already have on this machine is batch, not the interactive Codex TUI a Kolu lane would want.
3. **Registered runtimes eat the prompt file and inline the text.** Fine for `llm`. Wrong for agent CLIs that want `--prompt-file` / a TTY session.
4. **Adapter path pipes stdio and kills on a wall clock.** Incompatible with a Kolu PTY.
5. **`apm runtime setup` wants to own the user's home:** `~/.apm/runtimes`, shell rc, and for Codex `~/.codex/config.toml`. It assumes `/bin/bash`. It is not a scratch-local launcher.
6. **No grok or claude in the runtime registry.** The two CLIs we actually run in Kolu lanes are the two APM will not manage.
7. **Stdin inheritance.** Non-TTY parents make `codex exec` slurp stdin (`Reading additional input from stdin...`). Kolu PTYs would avoid that; a headless orchestrator calling `apm run` would not.
8. **GitHub-Models defaulting** fights our existing ChatGPT-auth Codex and xAI-auth Grok.

The earlier live success that looked launcher-like — `apm run grok-cli` printing `APM-GROK-LLM-OK` — is APM acting as a prompt compiler plus `shell=True`. Option 4 (§6) is the same path, measured for **interactive Claude TUI**.

### 5.3 Recommendation (see §6.5 for the ranked table)

**Do not adopt APM's four-runtime launcher. Do not put `apm run` on a Kolu argv. Do not wait on a Claude/Grok runtime PR.**

For Kolu lanes, argv must stay `claude` / `grok` / `codex`. Option 4 boots the TUI but **blinds Kolu agent detection** (`foreground=python`, `agent=null`; `kolu wait --until awaiting,waiting` times out). That is a measured orchestrator-breaker, not a banner tax.

If a shared context plane is wanted, evaluate APM as `apm install` / `apm compile` only.

Do **not**:

- run `apm runtime setup codex` on machines with a working ChatGPT Codex login
- treat `llm` + `llm-grok` as a Grok agent (model plugin; wall is `XAI_API_KEY`)
- put `apm run` on a lane unless we have accepted the wrapper-not-exec and banner costs in §6.3

If we need batch CI launches, write `codex exec` / `claude -p` / `grok --prompt-file` ourselves. APM's rewrite layer (double-`exec`, inlined prompts) is not an advantage.

---

## 6. Option 4 — `apm run` npm-scripts, no new runtime (Claude Code, interactive)

Priority addition. Hypothesis: because official docs already show `scripts: claude: "claude -p …"`, launching Claude through APM needs **no** `RuntimeAdapter` and **no** `apm runtime setup`. Test it the way our lanes actually work: interactive TUI, not a headless pipe.

Project: `spike-claude/`. Created with `apm init spike-claude -y --target claude`.

```yaml
targets: [claude]
scripts:
  agent-opus: "claude --model opus --dangerously-skip-permissions"
  hello:      "claude --model opus --dangerously-skip-permissions hello.prompt.md"
  hello-print: "claude -p --model opus hello.prompt.md"
```

`claude` is **not** in `runtime_names()`. Every one of these takes `ScriptRunner`'s generic branch: `subprocess.run(command, shell=True, env=…)` with **inherited stdio**. No `codex exec`-style rewrite. No prompt inlining.

### 6.1 Interactive TUI through `apm run agent-opus`

This shell is not a TTY (`stdin_tty=no`, `stdout_tty=no`). Running `apm run` here would not test a Kolu lane. The TUI was driven in a **detached tmux PTY** (140×40, then 140×60), session `apm-claude-spike`, never touching the user's attached session 0.

**It booted.** Claude Code v2.1.231 splash:

- `Opus 5 · Claude Max · srid@srid.ca's Organization`
- cwd `…/scratchpad/apm-spike/spike-claude`
- Footer: `bypass permissions on (shift+tab to cycle)`

Typed `/status` into the TUI (slash-command autocomplete appeared, Enter submitted). Overlay:

| Field | Value |
|---|---|
| Version | 2.1.231 |
| Session kind | **interactive** |
| cwd | `…/spike-claude` |
| Login | Claude Max account |
| Model | **`opus (claude-opus-5)`** |
| MCP | 3 connected, 1 need auth |
| Setting sources | User settings |

`/status` does not print a dedicated "permission mode" row in this version (dialog ends at "Setting sources" / "Esc to cancel"). Permission mode is confirmed by the TUI chrome: **`bypass permissions on`**. `--model opus` and `--dangerously-skip-permissions` both took.

`/exit` returned to the shell. APM exit code **0**.

**Stdin/TTY:** keys reached Claude (autocomplete + `/status` overlay). This is inherited-stdio, not a PTY allocated by APM. If the parent is a Kolu terminal PTY, Claude sees a TTY. If the parent is a pipe, it does not (see §6.3).

### 6.2 Prompt layer (brief/charter candidate)

`hello.prompt.md`:

```markdown
---
description: Hello prompt for the APM Claude brief/charter layer probe
input: [name]
---

Reply with exactly this single line and then stop. Do not call tools.

APM-CLAUDE-HELLO name=${input:name}
```

`apm preview hello --param name=Ada`:

```
original:  claude --model opus --dangerously-skip-permissions hello.prompt.md
compiled:  claude --model opus --dangerously-skip-permissions .apm/compiled/hello.txt
compiled file: .apm/compiled/hello.txt
```

File contents after substitution:

```
Reply with exactly this single line and then stop. Do not call tools.

APM-CLAUDE-HELLO name=Ada
```

Landed at **`.apm/compiled/hello.txt`** (stem of `hello.prompt.md`, `.prompt` stripped). APM only compiles tokens ending in `.prompt.md`. `--param` fills `${input:name}` in the prompt body; it is **not** exported to the environment.

Because Claude is unregistered, APM substitutes the **compiled file path**, not the text. That is the opposite of the Codex/llm path.

`apm run hello-print --param name=Ada` (docs-shaped `claude -p …`, no TTY needed) printed:

```
APM-CLAUDE-HELLO name=Ada
```

in 5.57s, exit 0. So `claude -p .apm/compiled/hello.txt` **reads the file as the prompt**. Compilation + substitution + Claude print-mode is a working brief layer.

`apm preview agent-opus` (no `.prompt.md`) prints "No `.prompt.md` files found" and leaves the command untouched. Correct for a TUI-only script.

**Charter-layer take:** APM's prompt compiler is real and small. The artifact is a plain `.txt` next to the project. Two ways to use it:

- `apm run hello-print --param …` for a one-shot brief (headless).
- `apm preview` / the compiled file as something Kolu/the agent reads, while the lane argv stays `claude --model opus --dangerously-skip-permissions`.

Do **not** attach `.prompt.md` to the interactive `agent-opus` script if the goal is "boot a TUI and wait." That would start Claude with the compiled path as the initial `[prompt]` and kick off a turn.

### 6.3 Failure shapes, latency, TTY weirdness

**Unknown script** — refuses loudly, exit 1:

```
[x] Script execution error: Script or prompt 'this-script-does-not-exist' not found.
Available scripts in apm.yml: agent-opus, hello, hello-print
```

It also hunts `.apm/prompts/`, `.github/prompts/`, `apm_modules/`, and offers `apm install <owner>/<repo>/path/to/prompt.prompt.md`. Loud enough for an orchestrator.

**No TTY** (this agent shell, from `spike-claude/`):

```
[>] Running script: agent-opus
Error: Input must be provided either through stdin or as a prompt argument when using --print
x Unknown execution failed (exit code: 1)
```

Direct `claude --model opus --dangerously-skip-permissions` with no TTY produces the **same** Claude error. Claude auto-enters `--print` when stdout is not a TTY. APM adds a wrapper and labels the runtime **Unknown**. A Kolu PTY avoids this; a piped orchestrator does not.

**Startup latency** (tmux PTY, time from sending the command to splash/bypass chrome):

| Launch | send → ready |
|---|---|
| `apm run agent-opus` | 1.32s, 1.21s |
| `claude --model opus --dangerously-skip-permissions` | 0.98s, 0.77s |

APM adds roughly **300–450 ms**. `apm preview agent-opus` alone is 0.46–0.57s (Python CLI + yaml + "no prompt" path). That is the whole wrapper tax: there is no compile step on `agent-opus`.

**TTY / UX weirdness:**

1. **Wrapper, not `exec`.** After `/exit`, the pane showed APM's banners around the session:

   ```
   [>] Running script: agent-opus
   [+] Unknown execution completed successfully (100.61s)
   [*] Script executed successfully!
   ```

   Kolu's process is `apm`. "Unknown" is because `claude` is not in the runtime registry. The success banner after a 100s interactive session is noise.

2. **Banners vs alt-screen.** The TUI takes the alt screen; APM's start line is hidden until Claude exits, then it reappears in scrollback. Not a broken TUI. Slightly messy for screen-scrapers that watch the parent from t=0.

3. **`shell=True`.** Fine for the strings we used. Quoting bugs are possible if a script grows spaces/globs.

4. **Registering Claude later would change this.** A Codex-shaped adapter would force a batch subcommand and inline prompt text. Option 4's fit is **load-bearing on Claude staying unregistered**.

5. Same splash through `apm run` and through direct `claude` — no extra TUI corruption, no dropped keys, no cooked vs raw stdin issues observed.

### 6.4 Kolu agent detection under the wrapper (measured, not guessed)

Question: if the lane argv is `apm run agent-opus`, does `kolu ls` still show Claude in the AGENT column, and do `working` / `waiting` track so `kolu wait --until …` and `kolu debrief` work?

Created two new terminals (killed after):

```
kolu create --cwd spike-claude --intent apm-spike-ctrl -- claude --model opus --dangerously-skip-permissions
  → 2d2fa9a8  ran="claude --model opus --dangerously-skip-permissions"

kolu create --cwd spike-claude --intent apm-spike-wrap -- <abs>/apm run agent-opus
  → c6a2db52  ran="…/apm run agent-opus"
```

Both TUIs actually came up (snapshots: prompt box + `bypass permissions on`). Then the same prompt was typed into both via `kolu send` + Enter: `Reply with the single word pong…`.

| Field after the turn | Control `kolu create -- claude …` | Wrapped `kolu create -- apm run agent-opus` |
|---|---|---|
| `kolu ls` AGENT | **`claude · waiting`** | **`—`** |
| `kolu ls` FOREGROUND | `claude` | **`python`** |
| `agent` JSON | `{kind: claude-code, state: waiting, model: claude-opus-5, sessionId, summary: "Respond with pong", contextTokens: 29127}` | **`null`** for the entire 12s poll and after |
| `lastAgentCommand` | `claude --model opus --dangerously-skip-permissions` | **`null`** |
| Window title | `✳ Respond with pong` | `✳ Respond with pong` (title still updates) |
| `kolu wait --until awaiting,waiting --timeout 8000` | **`met` in 8ms**, `fired: agent` | **`timeout` 8001ms** (`reach awaiting/waiting`) |
| `kolu wait --until working --timeout 12000` | timeout (turn already finished → `waiting`) | timeout (no agent object exists) |
| debrief-shaped `wait --until awaiting,waiting --settled 500 --snapshot 10` | (control already met) | **timeout 4001ms** |

`kolu ls` table, same moment:

```
ID        STATE  AGENT             FOREGROUND
2d2fa9a8  active claude · waiting  claude
c6a2db52  active —                 python
```

APM is a Python Click app (`…/.venv/bin/apm`). Kolu's foreground process is that Python, not `claude`. Agent kind/state is derived from a recognized agent binary; a `python` parent does not count even though a Claude TUI is on the PTY and the window title says "Claude Code".

**This blinds the orchestrator.** `kolu wait --until working` / `--until awaiting,waiting` and `kolu debrief` (which is those untils plus `--settled 15000 --snapshot 40`) never fire on an `apm run` lane. Babysitting that lane would have to scrape the screen, which is the lossy path the orchestrator was built to avoid.

Idle note: immediately after create, **both** had `agent=null` (control included). Detection on the control appeared once Claude had a session/turn (`sessionId` + `summary`). The wrap never acquired an `agent` object at all.

Both terminals were killed when the measurement finished (`kolu kill <id>`). No leftover `apm-spike-*` intents.

### 6.5 What this changes about "Claude runtime support"

§5.1 still stands as the *upstream adapter* sketch. This spike shows we **do not need it** to launch Claude.

The docs' examples were right: `scripts:` is a shell string. `claude` on PATH is enough. Adding Claude as a first-class runtime would be for `apm runtime setup claude` / `execute_prompt` / preference-order auto-discovery — none of which Kolu needs, and the Codex rewrite shows the adapter path is how you *lose* the interactive TUI.

### 6.6 Ranked recommendation

| Rank | Option | Interactive TUI? | Brief/charter? | Kolu AGENT detect? | Notes |
|---|---|---|---|---|---|
| 1 | Native Kolu argv (`kolu create -- claude …`) | Yes | Separate file / `claude -p` | **Yes** (`claude · waiting`) | Process *is* the agent. `wait`/`debrief` work. |
| 2 | APM install/compile only | n/a | Deploys `.claude/` | n/a | Right APM product, different job. |
| 3 | **Option 4 — `apm run` npm-scripts** | **Yes, measured** | **Yes** (`.apm/compiled/`, `--param`) | **No** (`foreground=python`, `agent=null`) | TUI works; orchestrator is blind. Major cost. |
| 4 | First-class APM runtime | Codex: no (`exec`) | Inlines text | Would still be a wrapper pid | Fights Kolu twice. |
| 5 | `llm` + `llm-grok` | No | One-shot completion | No | Wall: `XAI_API_KEY`. Not an agent. |

**Do not put `apm run` on a Kolu lane argv.** The TUI works; the orchestrator does not. Prefer rank 1: `kolu create -- claude --model opus --dangerously-skip-permissions`. `apm.yml` can still exist as a prompt compiler (`apm preview` / compiled `.txt` as a brief file) without sitting in the spawn path.

Codex cannot use Option 4 the same way: any `.prompt.md` script is rewritten to `codex exec`. A TUI Codex lane must be native argv.

---

## Appendix A. Environment walls (credentials we did not acquire)

| Wanted | State | Exact wall |
|---|---|---|
| `GITHUB_TOKEN` / `GITHUB_APM_PAT` | unset | `gh` keyring token exists; scopes `gist,read:org,repo,workflow` — no Models. `apm doctor`: "Token detected." |
| GitHub Models via `llm` | no key | `No key found - add one using 'llm keys set github' or set the GITHUB_MODELS_KEY or GITHUB_TOKEN environment variables` |
| xAI via `llm-grok` | no key | `No key found - add one using 'llm keys set grok' or set the XAI_API_KEY environment variable` |
| `OPENAI_API_KEY` | unset | Codex is ChatGPT-auth, not API-key-auth |
| ChatGPT-auth Codex generation | logged in | `The '<model>' model is not supported when using Codex with a ChatGPT account.` for `gpt-5.6-sol` (user default), `gpt-5.2`, `gpt-5.1-codex` |
| Official APM binary | downloaded | NixOS missing `libffi.so.8` / `libsqlite3.so.0` / `libz.so.1` |
| `apm runtime setup llm` | partial | `~/.bashrc` permission denied; wrapper shebang `/bin/bash` missing on NixOS |
| `apm runtime setup codex` | **not run** | Would overwrite `~/.codex/config.toml` |

## Appendix B. Artifacts in this scratch directory

| Path | What |
|---|---|
| `./apm` | Wrapper around the uv-installed 0.28.0 CLI |
| `./.venv/` | Nix-python 3.12 venv with `apm-cli` + `llm` + `llm-grok` |
| `./apm-src/` | Shallow clone of `microsoft/apm` |
| `./spike-codex/` | Minimal Codex `apm run` project |
| `./spike-grok/` | Minimal llm-grok + grok-CLI `apm run` project |
| `./spike-claude/` | Option 4: interactive Claude TUI + prompt-layer project |
| `./spike-claude/_tty/` | tmux pane captures + Kolu `ls`/`wait` JSON (`ls-after-*.json`, `wait-*-await.json`) |
| `~/.apm/runtimes/llm-venv/` | Side effect of `apm runtime setup llm --vanilla` (user home, not scratch-local) |

## Appendix C. Source map

- Launch registry: `apm-src/src/apm_cli/runtime/registry.py`
- Adapters: `apm-src/src/apm_cli/runtime/{base,copilot_runtime,codex_runtime,llm_runtime}.py`
- Manager / installer: `apm-src/src/apm_cli/runtime/manager.py`, `apm-src/scripts/runtime/`
- Script runner: `apm-src/src/apm_cli/core/script_runner.py`
- CLI: `apm-src/src/apm_cli/commands/{run,runtime}.py`
- Target catalogue (not launch): `apm-src/src/apm_cli/integration/targets.py`, `apm-src/src/apm_cli/core/target_catalog.py`
- Docs sources: `apm-src/docs/src/content/docs/integrations/runtime-compatibility.md`, `.../reference/cli/{run,runtime}.md`, `.../consumer/run-scripts.md`
