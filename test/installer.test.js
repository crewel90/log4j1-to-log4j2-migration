import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { installSkill, uninstallSkill } from '../scripts/installer-lib.js';

test('installer copies skill files and references to target home directory', () => {
    // Crea una cartella home temporanea isolata
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-skill-test-'));
    try {
        const result = installSkill(tempHome);
        assert.equal(result.success, true);

        const targetSkillDir = path.join(tempHome, '.gemini', 'skills', 'log4j1-to-log4j2-migration');
        assert.equal(fs.existsSync(targetSkillDir), true, 'Skill directory should exist');
        assert.equal(fs.existsSync(path.join(targetSkillDir, 'SKILL.md')), true, 'SKILL.md should exist');

        const referencesDir = path.join(targetSkillDir, 'references');
        assert.equal(fs.existsSync(referencesDir), true, 'references directory should exist');
        assert.equal(fs.existsSync(path.join(referencesDir, 'api-mappings.md')), true);
        assert.equal(fs.existsSync(path.join(referencesDir, 'config-converter.md')), true);
        assert.equal(fs.existsSync(path.join(referencesDir, 'custom-plugins.md')), true);
        assert.equal(fs.existsSync(path.join(referencesDir, 'pitfalls.md')), true);

        // Verifica disinstallazione
        const uninstResult = uninstallSkill(tempHome);
        assert.equal(uninstResult.success, true);
        assert.equal(fs.existsSync(targetSkillDir), false, 'Skill directory should be removed after uninstall');
    } finally {
        fs.rmSync(tempHome, { recursive: true, force: true });
    }
});
