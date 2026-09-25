import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Radice del progetto (cartella genitore di scripts)
const projectRoot = path.resolve(__dirname, '..');
const sourceGeminiDir = path.join(projectRoot, '.gemini');

export function installSkill(targetHome) {
    if (!fs.existsSync(sourceGeminiDir)) {
        throw new Error(`Directory sorgente .gemini non trovata in: ${sourceGeminiDir}`);
    }

    const targetGeminiDir = path.join(targetHome, '.gemini');

    // 1. Installa la Skill (~/.gemini/skills/log4j1-to-log4j2-migration)
    const sourceSkillDir = path.join(sourceGeminiDir, 'skills', 'log4j1-to-log4j2-migration');
    const targetSkillDir = path.join(targetGeminiDir, 'skills', 'log4j1-to-log4j2-migration');
    fs.mkdirSync(targetSkillDir, { recursive: true });
    fs.cpSync(sourceSkillDir, targetSkillDir, { recursive: true, force: true });

    // 2. Installa gli Script (~/.gemini/scripts)
    const sourceScriptsDir = path.join(sourceGeminiDir, 'scripts');
    const targetScriptsDir = path.join(targetGeminiDir, 'scripts');
    if (fs.existsSync(sourceScriptsDir)) {
        fs.mkdirSync(targetScriptsDir, { recursive: true });
        fs.cpSync(sourceScriptsDir, targetScriptsDir, { recursive: true, force: true });
    }

    // 3. Installa gli Hook (~/.gemini/hooks)
    const sourceHooksDir = path.join(sourceGeminiDir, 'hooks');
    const targetHooksDir = path.join(targetGeminiDir, 'hooks');
    if (fs.existsSync(sourceHooksDir)) {
        fs.mkdirSync(targetHooksDir, { recursive: true });
        fs.cpSync(sourceHooksDir, targetHooksDir, { recursive: true, force: true });
    }

    return {
        success: true,
        installedSkillPath: targetSkillDir,
        installedScriptsPath: targetScriptsDir,
        installedHooksPath: targetHooksDir
    };
}

export function uninstallSkill(targetHome) {
    const targetGeminiDir = path.join(targetHome, '.gemini');
    const targetSkillDir = path.join(targetGeminiDir, 'skills', 'log4j1-to-log4j2-migration');
    
    if (fs.existsSync(targetSkillDir)) {
        fs.rmSync(targetSkillDir, { recursive: true, force: true });
    }
    return {
        success: true,
        uninstalledPath: targetSkillDir
    };
}
