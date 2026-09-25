#!/usr/bin/env node

import os from 'node:os';
import { installSkill } from './installer-lib.js';

console.log('===========================================================');
console.log('📦 Installazione Skill Gemini CLI: log4j1-to-log4j2-migration');
console.log('===========================================================');

try {
    const userHome = os.homedir();
    const result = installSkill(userHome);
    console.log(`✅ Skill installata con successo in:`);
    console.log(`   ${result.installedPath}`);
    console.log('');
    console.log('🤖 La Skill è ora attiva nel tuo Gemini CLI!');
    console.log('   Puoi avviare una migrazione chiedendo al tuo agente:');
    console.log('   "Avvia la migrazione da Log4j 1 a Log4j 2 di questo progetto"');
    console.log('===========================================================');
} catch (err) {
    console.error('❌ Errore durante l\'installazione della Skill:', err.message);
    process.exit(1);
}
