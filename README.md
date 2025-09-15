# git-oops

A simple Git helper for common workflow fixes. No bloat, just the essentials.

## Installation

```bash
npm install -g git-oops
```

## Commands

### `wrong-branch [new-branch]`

Move commits from current branch to a new branch and reset current branch to upstream.

```bash
git oops wrong-branch              # Auto-generate branch name
git oops wrong-branch feature/fix  # Specify branch name
git oops wrong-branch --dry-run    # See what would happen
```

### `split`

Split staged changes into separate commits by top-level directory.

```bash
git oops split           # Split by directory
git oops split --dry-run # Preview the plan
```

### `yank`

"Just let me pull" - stash dirty work, pull with rebase, and restore.

```bash
git oops yank
```

### `pocket`

Save exact working state to a hidden ref.

```bash
git oops pocket              # Save locally
git oops pocket --push       # Save and push to origin
```

## Usage

Use either:

- `git-oops <command>`
- `git oops <command>` (Git auto-discovers the binary)

## License

MIT

