<?php

// PHP-CS-Fixer configuration for coevta.
//
// We follow PSR-12 but indent with TABS instead of the PSR-12-mandated four
// spaces. setIndent("\t") changes the character the `indentation_type` rule
// (part of @PSR12) emits, so the whole codebase ends up PSR-12 in spirit but
// tab-indented in practice.

$finder = PhpCsFixer\Finder::create()
	->in([
		__DIR__.'/app',
		__DIR__.'/config',
		__DIR__.'/database',
		__DIR__.'/routes',
		__DIR__.'/tests',
	])
	->name('*.php')
	->notName('*.blade.php');

return (new PhpCsFixer\Config())
	->setIndent("\t")
	->setLineEnding("\n")
	->setRules([
		'@PSR12' => true,
		'indentation_type' => true,
	])
	->setFinder($finder);
