import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { installSkill, uninstallSkill } from '../scripts/installer-lib.js';

test('installer copies skill, references, scripts, and hooks under .gemini/ in target home directory', () => {
    // Crea una cartella home temporanea isolata
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-skill-test-'));
    try {
        const result = installSkill(tempHome);
        assert.equal(result.success, true);

        // 1. Verifica cartella skill e references
        const targetSkillDir = path.join(tempHome, '.gemini', 'skills', 'log4j1-to-log4j2-migration');
        assert.equal(fs.existsSync(targetSkillDir), true, 'Skill directory should exist');
        assert.equal(fs.existsSync(path.join(targetSkillDir, 'SKILL.md')), true, 'SKILL.md should exist');

        const referencesDir = path.join(targetSkillDir, 'references');
        assert.equal(fs.existsSync(referencesDir), true, 'references directory should exist');
        assert.equal(fs.existsSync(path.join(referencesDir, 'api-mappings.md')), true);
        assert.equal(fs.existsSync(path.join(referencesDir, 'config-converter.md')), true);
        assert.equal(fs.existsSync(path.join(referencesDir, 'custom-plugins.md')), true);
        assert.equal(fs.existsSync(path.join(referencesDir, 'pitfalls.md')), true);

        // 2. Verifica cartella scripts direttamente sotto .gemini/scripts
        const scriptsDir = path.join(tempHome, '.gemini', 'scripts');
        assert.equal(fs.existsSync(scriptsDir), true, '.gemini/scripts directory should exist');
        assert.equal(fs.existsSync(path.join(scriptsDir, 'scan-legacy-log4j.ps1')), true);
        assert.equal(fs.existsSync(path.join(scriptsDir, 'scan-legacy-log4j.sh')), true);
        assert.equal(fs.existsSync(path.join(scriptsDir, 'convert-log4j1-config.sh')), true);

        // 3. Verifica cartella hooks direttamente sotto .gemini/hooks
        const hooksDir = path.join(tempHome, '.gemini', 'hooks');
        assert.equal(fs.existsSync(hooksDir), true, '.gemini/hooks directory should exist');
        assert.equal(fs.existsSync(path.join(hooksDir, 'pre-commit')), true);

        // Verifica disinstallazione
        const uninstResult = uninstallSkill(tempHome);
        assert.equal(uninstResult.success, true);
        assert.equal(fs.existsSync(targetSkillDir), false, 'Skill directory should be removed after uninstall');
    } finally {
        fs.rmSync(tempHome, { recursive: true, force: true });
    }
});
