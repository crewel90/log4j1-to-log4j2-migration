import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Radice del progetto (cartella genitore di scripts)
const projectRoot = path.resolve(__dirname, '..');
const sourceSkillDir = path.join(projectRoot, '.gemini', 'skills', 'log4j1-to-log4j2-migration');

export function installSkill(targetHome) {
    if (!fs.existsSync(sourceSkillDir)) {
        throw new Error(`Directory sorgente della skill non trovata in: ${sourceSkillDir}`);
    }

    const targetBaseDir = path.join(targetHome, '.gemini', 'skills');
    const targetSkillDir = path.join(targetBaseDir, 'log4j1-to-log4j2-migration');

    // Crea directory di destinazione se non esiste
    fs.mkdirSync(targetSkillDir, { recursive: true });

    // Copia ricorsiva della skill e dei suoi file di reference
    fs.cpSync(sourceSkillDir, targetSkillDir, { recursive: true, force: true });

    return {
        success: true,
        installedPath: targetSkillDir
    };
}

export function uninstallSkill(targetHome) {
    const targetSkillDir = path.join(targetHome, '.gemini', 'skills', 'log4j1-to-log4j2-migration');
    if (fs.existsSync(targetSkillDir)) {
        fs.rmSync(targetSkillDir, { recursive: true, force: true });
    }
    return {
        success: true,
        uninstalledPath: targetSkillDir
    };
}
