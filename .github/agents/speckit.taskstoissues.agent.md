---
description: Convert existing tasks into actionable, dependency-ordered GitHub issues for the feature based on available design artifacts.
tools: ['github/github-mcp-server/issue_write']
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. Resolve the active feature name, then run the script from repo root:
   1. If `$ARGUMENTS` contains a segment matching `\d{3}-[a-z0-9-]+`, use it as `SPECIFY_FEATURE`.
   2. Else scan all file paths in the current context (active editor path, terminal `Cwd` values) for a path segment matching `\d{3}-[a-z0-9-]+` and use the first match found.
   3. If no match, leave `SPECIFY_FEATURE` unset (script falls back to `git rev-parse --abbrev-ref HEAD`).
   Run, prefixing the env var when resolved:
   `SPECIFY_FEATURE="<value>" .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`
   Parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").
1. From the executed script, extract the path to **tasks**.
1. Get the Git remote by running:

```bash
git config --get remote.origin.url
```

> [!CAUTION]
> ONLY PROCEED TO NEXT STEPS IF THE REMOTE IS A GITHUB URL

1. For each task in the list, use the GitHub MCP server to create a new issue in the repository that is representative of the Git remote.

> [!CAUTION]
> UNDER NO CIRCUMSTANCES EVER CREATE ISSUES IN REPOSITORIES THAT DO NOT MATCH THE REMOTE URL
