#!/usr/bin/env php
<?php

// Fails the build when line coverage falls below a minimum percentage.
// Usage: php bin/coverage-check.php <clover.xml> <min-percent>
//
// Requires a coverage driver (pcov or xdebug) to have produced the clover
// report first — e.g. `composer coverage`.

$cloverPath = $argv[1] ?? 'build/coverage/clover.xml';
$minPercent = (float) ($argv[2] ?? 90);

if (! is_file($cloverPath)) {
	fwrite(STDERR, "Coverage report not found at {$cloverPath}.\n");
	fwrite(STDERR, "Run `composer coverage` (needs pcov or xdebug) first.\n");
	exit(1);
}

$xml = simplexml_load_file($cloverPath);

if ($xml === false || ! isset($xml->project->metrics)) {
	fwrite(STDERR, "Could not parse coverage metrics from {$cloverPath}.\n");
	exit(1);
}

$metrics = $xml->project->metrics;
$statements = (int) $metrics['statements'];
$covered = (int) $metrics['coveredstatements'];

$percent = $statements > 0 ? ($covered / $statements) * 100 : 100.0;

printf("Line coverage: %.2f%% (%d/%d statements), minimum %.2f%%\n", $percent, $covered, $statements, $minPercent);

if ($percent + 0.0001 < $minPercent) {
	fwrite(STDERR, sprintf("FAIL: coverage %.2f%% is below the %.2f%% threshold.\n", $percent, $minPercent));
	exit(1);
}

echo "OK: coverage threshold met.\n";
exit(0);
