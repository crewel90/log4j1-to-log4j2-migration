# Framework di Migrazione Nativa da Log4j 1.x a Log4j 2.x

Questo repository contiene il framework completo, la documentazione tecnica e la Skill per agenti AI (Gemini CLI) per migrare applicazioni Java legacy da **Log4j 1.x** (o suoi fork come *reload4j*) alla versione nativa **Log4j 2.x**.

L'approccio adottato è il **Refactoring Nativo**:
* **Nessun bridge permanente:** Eliminazione totale del debito tecnico e delle dipendenze runtime legacy di Log4j 1 (`log4j:log4j`, `reload4j`).
* **API Log4j 2 Nativa:** Conversione del codice verso `org.apache.logging.log4j.LogManager` e `Logger`, con supporto e linee guida per progetti che adottano la facciata SLF4J (`log4j-slf4j2-impl`).
* **Configurazione Canonica:** Transizione dai formati `log4j.properties` e `log4j.xml` al formato standard `log4j2.xml`.
* **Supporto Progetti Multi-Modulo:** Gestione avanzata della topologia Maven (`<dependencyManagement>`, BOM, separazione tra moduli business e moduli di packaging) e Gradle multi-project.

---

## 📚 Struttura della Documentazione

Il dossier tecnico si articola nei seguenti documenti:

1. **[MIGRATION PLAYBOOK](docs/MIGRATION_PLAYBOOK.md)**: Il playbook operativo end-to-end con i 6 step esecutivi, i criteri di decisione, i gate di revisione e i comandi di build.
2. **Guide Tematiche di Riferimento (`docs/references/`)**:
   * **[01. Gestione Dipendenze & Build Maven/Gradle](docs/references/01-dependencies-and-build.md)**: Configurazione BOM, scoping `log4j-api` vs `log4j-core`, esclusioni globali e gestione multi-modulo.
   * **[02. Mapping API & Refactoring Codice Java](docs/references/02-api-and-code-mappings.md)**: Matrice completa di conversione classi/metodi, migrazione da `MDC`/`NDC` a `ThreadContext`, rimozione di `Category`/`Priority` e ottimizzazione del logging parametrizzato (`{}`).
   * **[03. Migrazione dei File di Configurazione](docs/references/03-configuration-migration.md)**: Da `log4j.properties`/`log4j.xml` a `log4j2.xml`, sintassi dei lookups (`${sys:...}`), rollover policies e conversione PatternLayout.
   * **[04. Riscrivere Componenti Custom](docs/references/04-custom-components.md)**: Guida alla conversione di `AppenderSkeleton`, Layout e Filtri proprietari nel pattern moderno `@Plugin` di Log4j 2 con Builder.
   * **[05. Automazione con OpenRewrite](docs/references/05-openrewrite-recipes.md)**: Esecuzione delle ricette OpenRewrite per il refactoring automatico massivo su grandi codebase.
   * **[06. Risoluzione Errori & Edge Cases](docs/references/06-pitfalls-and-edge-cases.md)**: Risoluzione di conflitti di classpath, rimozione di `LogManager.shutdown()`, configurazione programmatica e diagnostica.

---

## 🛠️ Tooling & Script di Supporto (`scripts/`)

Nella cartella `scripts/` sono forniti strumenti di automazione locale:
* **`scripts/scan-legacy-log4j.ps1` / `.sh`**: Scansione istantanea della codebase per censire POM, file di configurazione, classi legacy e appender custom.
* **`scripts/convert-log4j1-config.sh`**: Wrapper per l'utility ufficiale di conversione Apache.
* **`hooks/pre-commit`**: Git hook opzionale per impedire il reinserimento di import `org.apache.log4j.*`.

---

## 🚀 Installazione Rapida per Colleghi (via npm)

Questo repository è configurato come pacchetto Node/npm per consentire l'installazione automatica della Skill in qualsiasi ambiente di sviluppo:

```bash
# 1. Clona il repository o estrai l'archivio
git clone <url-del-repository>
cd migration_Log4J2

# 2. Installa con npm (esegue automaticamente il postinstall della Skill)
npm install
```

Lo script `postinstall` copierà automaticamente `SKILL.md` e tutti i file di `references/` nella directory globale delle skill di Gemini CLI (`~/.gemini/skills/log4j1-to-log4j2-migration/`), rendendo immediatamente disponibile la skill all'agente.

Se desideri disinstallare la skill in un secondo momento:
```bash
npm run uninstall-skill
```

---

## 🤖 Skill Gemini CLI (`log4j1-to-log4j2-migration`)

È inclusa e installabile la Skill globale per l'agente AI Gemini CLI situata in:
```text
~/.gemini/skills/log4j1-to-log4j2-migration/
├── SKILL.md
└── references/
    ├── api-mappings.md
    ├── config-converter.md
    ├── custom-plugins.md
    └── pitfalls.md
```

### Come Usare la Skill nell'Agente
Quando lavori su un progetto Java da migrare, puoi chiedere all'agente:
> *"Avvia la migrazione di questo progetto da Log4j 1 a Log4j 2"*
oppure
> *"Esegui l'audit delle dipendenze Log4j su questa applicazione"*

L'agente attiverà la skill ed eseguirà il workflow a 6 step, fermandosi ad ogni step per presentarti le modifiche, verificare la build con `mvn clean install` e iterare secondo le tue indicazioni prima di procedere.
