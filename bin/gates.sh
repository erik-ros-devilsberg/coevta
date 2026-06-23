#!/usr/bin/env bash
#
# Full quality gates for coevta.
#
# Runs every check we require before code is considered done: code style,
# static analysis, tests, coverage (when a driver is available) and a
# dependency vulnerability audit. Runs ALL gates even if an earlier one fails,
# then exits non-zero if any failed — so you see every problem in one pass.
#
# Usage:  composer gates   (preferred)   or   bash bin/gates.sh

set -uo pipefail

# Always run from the project root regardless of where we're invoked.
cd "$(dirname "$0")/.." || exit 1

fail=0

run() {
	local name="$1"
	shift
	echo "▶ ${name}"
	if "$@"; then
		echo "✔ ${name}"
	else
		echo "✖ ${name}"
		fail=1
	fi
	echo
}

# 1. Code style — verify only (does not modify files). Run `composer fix` to fix.
run "Code style (PHP-CS-Fixer, tabs)" vendor/bin/php-cs-fixer fix --dry-run --diff

# 2. Static analysis at max level.
run "Static analysis (PHPStan max)" vendor/bin/phpstan analyse --memory-limit=512M --no-progress

# 3. Test suite.
run "Tests (PHPUnit)" php artisan test

# 4. Coverage >= 90% — only when a coverage driver is present.
if php -r 'exit((extension_loaded("pcov") || extension_loaded("xdebug")) ? 0 : 1);'; then
	run "Coverage (>=90%)" composer coverage
else
	echo "▶ Coverage (>=90%)"
	echo "⊘ skipped — no coverage driver (pcov or xdebug) installed"
	echo
fi

# 5. Dependency vulnerability audit.
run "Dependency audit (composer)" composer audit

if [ "${fail}" -ne 0 ]; then
	echo "❌ GATES FAILED"
	exit 1
fi

echo "✅ ALL GATES PASSED"
