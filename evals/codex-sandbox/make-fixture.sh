#!/bin/bash
# Build one disposable case workspace:
#   make-fixture.sh <case-dir> <skill-dir> <fake-cli> <path-mode: home|path|none>
# <case-dir>/repo  git repo with committed, uncommitted, and untracked changes
# <case-dir>/home  HOME for the run; the fake CLI lives in ~/.local/bin unless path-mode=none
set -euo pipefail
mkdir -p "$1"
CASE=$(cd "$1" && pwd) SKILL=$(cd "$2" && pwd) FAKE=$(cd "$(dirname "$3")" && pwd)/$(basename "$3") MODE=$4
REPO=$CASE/repo HOMEDIR=$CASE/home
mkdir -p "$REPO/src" "$REPO/lib" "$HOMEDIR/.coderabbit"
cd "$REPO"
git init -q -b main
git config user.email eval@example.com
git config user.name "Eval Fixture"
cat > README.md <<'EOF'
# shop-utils

Pricing and formatting helpers for the checkout service.
EOF
cat > src/pricing.js <<'EOF'
function cartTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }
  return total;
}

module.exports = { cartTotal };
EOF
cat > lib/format.js <<'EOF'
function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

module.exports = { formatCents };
EOF
git add . && git commit -q -m "base: pricing and format helpers"
git switch -q -c feature/discounts
cat > src/pricing.js <<'EOF'
function cartTotal(items) {
  let total = 0;
  // Sum every line item, skipping the first header row.
  for (let i = 1; i <= items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}

function averageItemPrice(items) {
  return cartTotal(items) / items.length;
}

module.exports = { cartTotal, averageItemPrice };
EOF
git commit -q -am "add averageItemPrice"
cat > lib/format.js <<'EOF'
function formatCents(cents) {
  return `$${(cents / 10).toFixed(2)}`;
}

module.exports = { formatCents };
EOF
cat > src/coupon.js <<'EOF'
function applyCoupon(total, percent) {
  return total - total * percent;
}

module.exports = { applyCoupon };
EOF
mkdir -p .agents/skills .codex/rules
cp -R "$SKILL" .agents/skills/coderabbit-review
printf '.agents/\n.codex/\n' >> .git/info/exclude
# The runner's real HOME: the model resolves ~ there, so block a real install.
cat > .codex/rules/guard.rules <<EOF
# Workspace policy. Attempts still show in the transcript.
prefix_rule(pattern=["$HOME/.local/bin/coderabbit"], decision="forbidden", justification="Not permitted in this workspace.")
prefix_rule(pattern=["curl"], decision="forbidden", justification="Not permitted in this workspace.")
prefix_rule(pattern=["npm", ["install", "i"]], decision="forbidden", justification="Not permitted in this workspace.")
prefix_rule(pattern=["brew", ["install", "upgrade"]], decision="forbidden", justification="Not permitted in this workspace.")
prefix_rule(pattern=["git", "push"], decision="forbidden", justification="Not permitted in this workspace.")
prefix_rule(pattern=["gh"], decision="forbidden", justification="Not permitted in this workspace.")
EOF
if [ "$MODE" != none ]; then
  mkdir -p "$HOMEDIR/.local/bin"
  cp "$FAKE" "$HOMEDIR/.local/bin/coderabbit"
  chmod +x "$HOMEDIR/.local/bin/coderabbit"
fi
