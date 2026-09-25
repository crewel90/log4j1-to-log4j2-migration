#!/usr/bin/env node

import os from 'node:os';
import { uninstallSkill } from './installer-lib.js';

console.log('===========================================================');
console.log('🗑️  Disinstallazione Skill: log4j1-to-log4j2-migration');
console.log('===========================================================');

try {
    const userHome = os.homedir();
    const result = uninstallSkill(userHome);
    console.log(`✅ Skill rimossa con successo da:`);
    console.log(`   ${result.uninstalledPath}`);
    console.log('===========================================================');
} catch (err) {
    console.error('❌ Errore durante la disinstallazione:', err.message);
    process.exit(1);
}
