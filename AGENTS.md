# GitHub identity for this project

All work in this repository on this machine must use the GitHub account **bellpepperfarm** (GitHub user ID 316446930), never a personal account.

Before Git operations, use the existing authenticated configuration explicitly; Codex can set an isolated XDG_CONFIG_HOME that otherwise hides it:

```sh
export GH_CONFIG_DIR="$HOME/.config/gh"
gh auth switch --hostname github.com --user bellpepperfarm
gh api user --jq .login
```

The last command must print `bellpepperfarm`. Stop before committing or pushing if that identity cannot be verified. Do not fall back to another account.

Set repository-local commit identity and credential routing:

```sh
git config --local user.name bellpepperfarm
git config --local user.email 316446930+bellpepperfarm@users.noreply.github.com
git config --local credential.https://github.com.helper ''
git config --local --add credential.https://github.com.helper '!GH_CONFIG_DIR="$HOME/.config/gh" /opt/homebrew/bin/gh auth git-credential'
```

Use this account for both author and committer; do not add personal co-author trailers. Verify the remote is `https://github.com/bellpepperfarm/cheesecakefactorydle.git` before pushing. History rewrites and force pushes require explicit user authorization; ordinary work does not imply permission for another rewrite.

# Published game data

Published menu snapshots, selection seeds, effective dates, and rule versions are immutable. See `data/README.md` before editing menus. Add future-dated versions instead of overwriting published ones. Each restaurant has separate challenge and storage namespaces. Keep image credits specific to the source dataset.
