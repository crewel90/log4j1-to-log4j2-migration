#!/usr/bin/env node

import os from 'node:os';
import { installSkill } from './installer-lib.js';

console.log('===========================================================');
console.log('📦 Installazione Agent Harness Gemini CLI (Log4j Migration)');
console.log('===========================================================');

try {
    const userHome = os.homedir();
    const result = installSkill(userHome);
    console.log(`✅ Risorse installate con successo in:`);
    console.log(`   - Skill:   ${result.installedSkillPath}`);
    console.log(`   - Script:  ${result.installedScriptsPath}`);
    console.log(`   - Hook:    ${result.installedHooksPath}`);
    console.log('');
    console.log('🤖 L\'Harness è ora attivo nel tuo Gemini CLI!');
    console.log('   Puoi avviare una migrazione chiedendo al tuo agente:');
    console.log('   "Avvia la migrazione da Log4j 1 a Log4j 2 di questo progetto"');
    console.log('===========================================================');
} catch (err) {
    console.error('❌ Errore durante l\'installazione:', err.message);
    process.exit(1);
}
