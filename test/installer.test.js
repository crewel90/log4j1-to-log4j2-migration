import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { installSkill, uninstallSkill } from '../scripts/installer-lib.js';

test('installer copies skill files, references, scripts, and hooks to target home directory', () => {
    // Crea una cartella home temporanea isolata
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-skill-test-'));
    try {
        const result = installSkill(tempHome);
        assert.equal(result.success, true);

        const targetSkillDir = path.join(tempHome, '.gemini', 'skills', 'log4j1-to-log4j2-migration');
        assert.equal(fs.existsSync(targetSkillDir), true, 'Skill directory should exist');
        assert.equal(fs.existsSync(path.join(targetSkillDir, 'SKILL.md')), true, 'SKILL.md should exist');

        // Verifica cartella references
        const referencesDir = path.join(targetSkillDir, 'references');
        assert.equal(fs.existsSync(referencesDir), true, 'references directory should exist');
        assert.equal(fs.existsSync(path.join(referencesDir, 'api-mappings.md')), true);
        assert.equal(fs.existsSync(path.join(referencesDir, 'config-converter.md')), true);
        assert.equal(fs.existsSync(path.join(referencesDir, 'custom-plugins.md')), true);
        assert.equal(fs.existsSync(path.join(referencesDir, 'pitfalls.md')), true);

        // Verifica cartella scripts interna alla skill
        const scriptsDir = path.join(targetSkillDir, 'scripts');
        assert.equal(fs.existsSync(scriptsDir), true, 'scripts directory should exist inside skill');
        assert.equal(fs.existsSync(path.join(scriptsDir, 'scan-legacy-log4j.ps1')), true);
        assert.equal(fs.existsSync(path.join(scriptsDir, 'scan-legacy-log4j.sh')), true);
        assert.equal(fs.existsSync(path.join(scriptsDir, 'convert-log4j1-config.sh')), true);

        // Verifica cartella hooks interna alla skill
        const hooksDir = path.join(targetSkillDir, 'hooks');
        assert.equal(fs.existsSync(hooksDir), true, 'hooks directory should exist inside skill');
        assert.equal(fs.existsSync(path.join(hooksDir, 'pre-commit')), true);

        // Verifica disinstallazione
        const uninstResult = uninstallSkill(tempHome);
        assert.equal(uninstResult.success, true);
        assert.equal(fs.existsSync(targetSkillDir), false, 'Skill directory should be removed after uninstall');
    } finally {
        fs.rmSync(tempHome, { recursive: true, force: true });
    }
});
