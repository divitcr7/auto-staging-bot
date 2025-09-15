# git-oops

A practical Git helper for common workflow fixes. Simple, safe, and actually useful.

## Installation

```bash
npm install -g git-oops
```

## Commands

### Quick Fixes

#### `save [message]`

Quickly save all changes with a commit (like `git add . && git commit`)

```bash
git oops save                           # Quick save with default message
git oops save -m "fix: updated styles"  # Save with custom message
git oops save --yes                     # Skip confirmation
```

#### `fixup`

Fix the last commit with current changes

```bash
git oops fixup                    # Add current changes to last commit
git oops fixup -m "better title" # Also update the commit message
git oops fixup --dry-run         # See what would happen
```

#### `undo`

Safely undo recent commits (keeps changes in working directory)

```bash
git oops undo           # Undo last commit
git oops undo -n 3      # Undo last 3 commits
git oops undo --dry-run # Preview what would be undone
```

### Workflow Fixes

#### `wrong-branch [new-branch]`

Move commits from current branch to a new branch and reset current branch to upstream

```bash
git oops wrong-branch              # Auto-generate branch name
git oops wrong-branch feature/fix  # Specify branch name
git oops wrong-branch --dry-run    # See what would happen
```

#### `split`

Split staged changes into separate commits by top-level directory

```bash
git oops split           # Split by directory
git oops split --dry-run # Preview the plan
```

#### `yank`

"Just let me pull" - stash dirty work, pull with rebase, and restore

```bash
git oops yank
```

#### `revert-merge <sha>`

Safely revert a merge commit with proper safety checks

```bash
git oops revert-merge abc1234      # Revert merge commit
git oops revert-merge abc1234 -m 2 # Use parent 2 as mainline
git oops revert-merge abc1234 --dry-run # Preview the revert
```

### State Management

#### `pocket`

Save exact working state to a hidden ref

```bash
git oops pocket              # Save locally
git oops pocket --push       # Save and push to origin
```

## Safety Features

- **Safety tags**: All destructive operations create backup tags automatically
- **Confirmation prompts**: Asks before doing anything destructive (use `--yes` to skip)
- **Dry run mode**: Preview what would happen with `--dry-run`
- **Push detection**: Warns when modifying pushed commits
- **Protected branch detection**: Extra warnings for main/master branches

## Usage

Use either:

- `git-oops <command>`
- `git oops <command>` (Git auto-discovers the binary)

## Examples

**Made a typo in your last commit?**

```bash
# Fix it and update the commit
echo "fixed typo" >> file.txt
git oops fixup
```

**Committed on the wrong branch?**

```bash
git oops wrong-branch feature/actual-fix
```

**Need to quickly save everything?**

```bash
git oops save -m "WIP: working on feature X"
```

**Accidentally committed sensitive data?**

```bash
git oops undo  # Undoes commit but keeps changes
# Remove sensitive data, then recommit
```

**Mixed up different changes in staging?**

```bash
git oops split  # Splits by directory into separate commits
```

## License

MIT
