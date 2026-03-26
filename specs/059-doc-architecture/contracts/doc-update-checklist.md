# Contract: Documentation Update Checklist

**File**: `docs/doc-update-checklist.md`  
**Feature**: 059-doc-architecture

---

## Required Content

### Title
"Documentation Update Checklist"

### Introduction
Brief paragraph explaining that this checklist should be followed after completing any feature spec.

### Checklist Steps

| # | Condition | Action | Target File |
|---|-----------|--------|-------------|
| 1 | Feature adds or changes a user-visible capability | Add or update feature highlight entry | `README.md` |
| 2 | Feature adds or changes a user-visible capability | Add or update feature entry | `FEATURES.md` |
| 3 | Feature modifies system architecture (new component, changed data flow) | Update or create subsystem architecture page | `docs/{subsystem}.md` |
| 4 | Feature adds a new subsystem or major component | Update overview diagram and add link to new page | `docs/architecture.md` |
| 5 | Feature adds a new plugin or changes plugin API | Update plugin system page | `docs/plugin-system.md` |
| 6 | Any documentation change includes Mermaid diagrams | Verify diagrams render correctly on GitHub | All changed files |
| 7 | Feature is fully complete and merged | Verify all cross-references and links still work | All doc files |

### Verification Section
- How to preview Mermaid diagrams (push to branch, view on GitHub)
- How to check broken links (manual or with markdown-link-check)
