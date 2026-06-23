<?php

// Reads the project version from version.json (the single source of truth,
// bumped by the agile commit script) so it can be surfaced through the API.
$versionFile = dirname(__DIR__).'/version.json';
$version = '0.0.0';

if (is_file($versionFile)) {
	$decoded = json_decode((string) file_get_contents($versionFile), true);

	if (is_array($decoded) && isset($decoded['version']) && is_string($decoded['version'])) {
		$version = $decoded['version'];
	}
}

return [
	// Application version, mirrored from version.json.
	'version' => $version,
];
