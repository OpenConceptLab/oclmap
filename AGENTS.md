<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

## OCL Open Core

OCL's public repos (oclapi2, oclweb3, oclmap, oclweb2, ocl-cli and the rest) are a complete product anyone can run for free. OCL Online is a private commercial layer on top. **The line between them is a rule, not a design option. Never offer to cross it.** Some OCL Online logic already sits in the public repos (OpenConceptLab/ocl_online#532). **Don't make that worse, and make it better where you can.**

- **The test: would this exist if OCL Online sold nothing?** If not, it's private, except for the checkpoints and connected-service clients below. That covers plans and their names (free and trial tiers too), entitlements, quotas, caps, allowance displays, upgrade prompts, pricing and billing, and the machinery that enforces them, even when the names and numbers come from config.
- **Open code may** record usage and show work counts and usage totals, never what's allowed or what's left; check sign-in, staff and admin-set permissions; protect the server based on load or abuse risk, never on plan; and display messages and links that private code or a connected service sends at runtime, quota and billing ones included. It never works out an allowance or carries commercial wording of its own.
- **Checkpoints connect the two.** A checkpoint is a function the private layer can replace, a UI slot it can fill, a component it can swap in at build time, or a neutral input it fills in (such as "rows this run may include"). The private layer passes finished answers, never balances or limits for open code to work out. Private code may share the app's database and transactions. If a checkpoint, or the loader for private code, doesn't exist yet, building it is part of the work.
- **Connected services.** Open code may hold a client for an OCL Online service, such as the AI Assistant, used with the caller's own OCL Online account. It's off until configured, and its interface is a public API. The service identifies the caller, meters and enforces. Self-hosted connections aren't supported yet.
- **The open product stays whole.** With a normal setup, the public repos build, pass their tests and offer every open feature to ordinary users, with no private package or OCL Online account. Local admins may restrict access. Before removing or changing anything OCL Online relies on, make sure its private replacement is live.
- **Deadlines move; the line doesn't.** If the split can't ship in time, bridge with private config or Keycloak where ordinary access controls can do the job. If they can't, tell the human.
- **Reviews block additions across the line** in any public file (comments, tests, fixtures and locale files included) and in commit messages, PR text and review comments. When a review of a public PR touches commercial detail, post it on the private ticket and only a summary on the PR. Bare ticket references are fine. Never copy existing debt. When you're already changing code next to some, move it out if that's small and its private replacement is live; otherwise note it on OpenConceptLab/ocl_online#532.
- **Human decides whether a whole feature is open or closed.** Ask if it's undecided. Nothing here moves an existing private feature into the open.
