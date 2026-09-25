---
name: log4j1-to-log4j2-migration
description: Use when migrating a Java project from Log4j 1.x (or reload4j) to native Log4j 2.x API - guides dependency management (BOM, exclusions), multi-module POM topology, log4j2.xml configuration conversion, Java code refactoring (LogManager, ThreadContext, parameterized logging), custom appender plugins, with human-in-the-loop review gates and build verification after each step.
---

# Log4j 1.x to Log4j 2.x Native Migration Skill

Guida procedurale per agenti AI per condurre la migrazione nativa e completa di applicazioni Java da Log4j 1.x (o reload4j) a Log4j 2.x.

## Principi Fondamentali

1. **Refactoring Nativo:** Non adottare il bridge `log4j-1.2-api` come soluzione finale; aggiornare il codice e le configurazioni alle API native di Log4j 2.
2. **Multi-Modulo Disciplinato:** Ispezionare la gerarchia di tutti i `pom.xml`. Centralizzare BOM ed esclusioni nel Parent POM. Riservare `log4j-core` e `log4j2.xml` ai moduli di runtime/packaging.
3. **Ottimizzazione Context-Window (Sub-Agent Harness):** Per progetti di medie/grandi dimensioni, non leggere decine di file Java o POM direttamente nel contesto principale. Delegare la scansione a `codebase_investigator` e i refactoring batch o la diagnosi di build a `@generalist`.
4. **Human-in-the-Loop & Build Gate Obbligatorio:** Ad ogni step:
   - Applica le modifiche.
   - Esegui la build di verifica (`mvn clean install` o compilazione modulo).
   - Metti in pausa e presenta sintesi ed esito allo sviluppatore.
   - Se lo sviluppatore richiede modifiche o segnala errori, itera: correggi, riesegui immediatamente la build e ripresenta.
   - Procedi allo step successivo **solo dopo esplicita approvazione**.
5. **Git Safety & Protezione dei Branch Principali (`main` / `master`):**
   - Non lavorare MAI direttamente su `main` o `master`. Crea sempre un branch dedicato (`migration/log4j2`).
   - Esegui commit atomici ad ogni step validato (Conventional Commits).
   - È fatto **assoluto divieto di merge o push automatico su `main`/`master`**. L'integrazione avviene tramite Pull Request o, se locale, **solo ed esclusivamente previa esplicita autorizzazione formale dell'utente**.

---

## Workflow Operativo Completo

### STEP 0: Setup Ambiente (JDK / Maven) & Inizializzazione Git
1. **Verifica JDK e Maven:**
   - Chiedi allo sviluppatore quale versione di JDK e Maven siano richieste per l'applicativo.
   - Esegui la verifica con:
     ```bash
     java -version
     mvn -version
     ```
   - **Opzione Configurazione Autonoma:** Se la versione attiva non corrisponde o servono script locali/SDKMAN, lascia che lo sviluppatore configuri l'ambiente in autonomia nel terminale. Alla ripresa, riesegui `java -version` e `mvn -version` per confermare che l'ambiente sia pronto.
2. **Inizializzazione e Scelta del Branch:**
   - **Se il progetto non è versionato (nessun `.git`):**
     1. Chiedi conferma per `git init`.
     2. Esegui il commit di baseline: `git add . && git commit -m "chore: initial baseline commit before log4j2 migration"`.
     3. Chiedi il nome desiderato per il branch di migrazione (es. suggerendo `migration/log4j2`).
     4. Crea e spostati sul branch: `git checkout -b <nome-scelto>`.
   - **Se il progetto è già versionato:**
     1. Verifica con `git status` che il working tree sia pulito.
     2. Riconosci il branch corrente. **Ricorda:** `main`, `master`, `collaudo`, `test`, `prod` **NON sono branch di sviluppo**. I branch di sviluppo usano convenzioni come `sviluppo`, `svil`, `svl`, `dev`, `develop`.
     3. Se ci si trova su un branch non di sviluppo (es. `collaudo` o `main`), avvisa l'utente e chiedi di effettuare il checkout del branch di sviluppo effettivo.
     4. Chiedi allo sviluppatore quale nome assegnare al nuovo branch (es. suggerendo `migration/log4j2` o recependone uno custom).
     5. Crea e posizionati sul branch: `git checkout -b <nome-scelto>`.
     6. **Divieto assoluto di lavorare direttamente sui branch protetti (`main`, `master`, `collaudo`).**

---

### STEP 1: Audit & Project Topology Analysis
1. **Attivazione Hook Pre-Commit:**
   - Installa l'hook nel repository target: `cp .gemini/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit` (o PowerShell: `Copy-Item -Force '.gemini\hooks\pre-commit' '.git\hooks\pre-commit'`).
2. **Analisi Strutturale del Build System:**
   - Identifica se il progetto è a modulo singolo o multi-modulo Maven (`<modules>` nel POM radice) / Gradle multi-project (`settings.gradle`).
   - Mappa tutti i `pom.xml`, le relazioni parent-child e la sezione `<dependencyManagement>`.
   - *Delega consigliata per progetti estesi:* Invia `@codebase_investigator` per scansionare l'albero e farti restituire un report sintetico di topologia.
3. **Censimento Risorse:**
   - Esegui lo scanner rapido fornito nel bundle dell'harness (`.gemini/scripts/scan-legacy-log4j.ps1` o `.gemini/scripts/scan-legacy-log4j.sh`, oppure da `~/.gemini/scripts/`).
   - Elenca i file di configurazione (`log4j.properties`, `log4j.xml`).
   - Rileva l'uso di componenti custom (`AppenderSkeleton`, `Layout`, `Filter`).
4. **Gate Step 1 (Pausa):** Presenta allo sviluppatore:
   - Topologia del progetto (moduli libreria vs moduli packaging).
   - Numero di classi impattate e file di configurazione trovati.
   - Piano di ripartizione delle dipendenze per modulo.
   - *Attendi approvazione o istruzioni di aggiustamento.*

---

### STEP 2: Build Configuration (Maven / Gradle)
1. **Parent POM (`<dependencyManagement>`):**
   - Inserisci `org.apache.logging.log4j:log4j-bom` (versione 2.24.x o compatibile col JDK del progetto) con scope `import` e type `pom`.
   - Aggiungi esclusioni globali di `log4j:log4j`, `reload4j`, `slf4j-log4j12` e `log4j-over-slf4j`.
2. **Moduli Business / Librerie (JAR):**
   - Inserisci unicamente `log4j-api` (scope `compile`).
   - Non inserire `log4j-core` se non in scope `test` (se necessario per i test unitari del modulo).
3. **Moduli Packaging / Web Application (WAR, Fat JAR, EAR):**
   - Inserisci `log4j-core` (scope `runtime` o `compile`).
   - Se presente SLF4J, inserisci `log4j-slf4j2-impl` (o `log4j-slf4j-impl` per SLF4J 1.7.x).
4. **Verifica & Build Gate:**
   - Esegui: `mvn dependency:tree -Dincludes=log4j:*,ch.qos.reload4j:*`
   - Esegui: `mvn clean install -DskipTests`
   - *Gate Step 2 (Pausa):* Mostra il diff dei POM e l'esito della build. Raccogli feedback, applica eventuali correzioni rieseguendo la build, e attendi l'ok per procedere.
   - *Commit Atomico (dopo approvazione):*
     `git add **/pom.xml && git commit -m "build(deps): migrate dependencies to Log4j 2 BOM and exclude legacy log4j1"`

*Riferimento dettagliato: consulta `references/api-mappings.md`.*

---

### STEP 3: Config File Migration (`log4j2.xml`)
1. **Creazione di `log4j2.xml`:**
   - Posiziona il file in `src/main/resources/log4j2.xml` del modulo di runtime/packaging.
   - Imposta `<Configuration status="WARN" monitorInterval="30">`.
2. **Traduzione dei Parametri:**
   - Sostituisci variabili `${prop}` con `${sys:prop}` (o `${env:prop}`).
   - Converti gli appender Console, File e RollingFile (usando `TimeBasedTriggeringPolicy` e `SizeBasedTriggeringPolicy`).
   - Imposta `<DefaultRolloverStrategy fileIndex="min"/>` per mantenere l'ordinamento numerico legacy.
   - Rimuovi o archivia i vecchi file `log4j.properties`/`log4j.xml`.
3. **Gate Step 3 (Pausa):** Presenta il nuovo file `log4j2.xml` allo sviluppatore. Verifica insieme livelli, percorsi dei file e policy di rotazione. Applica eventuali modifiche e attendi l'approvazione.
   - *Commit Atomico (dopo approvazione):*
     `git add **/log4j2.xml && git commit -m "chore(logging): convert log4j configuration to canonical log4j2.xml"`

*Riferimento dettagliato: consulta `references/config-converter.md`.*

---

### STEP 4: Java Code Refactoring
1. **Aggiornamento Codice:**
   - Sostituisci `org.apache.log4j.Logger` e `LogManager` con `org.apache.logging.log4j.Logger` e `LogManager`.
   - Sostituisci `Logger.getLogger(...)` e `Category.getInstance(...)` con `LogManager.getLogger(...)`.
   - Converti `MDC` e `NDC` in `ThreadContext` (`put`, `push`, `clearMap`, `clearStack`).
   - Sostituisci concatenazioni costose con logging parametrizzato `{}` e rimuovi blocchi `if (logger.isDebugEnabled())` non necessari.
   - Rimuovi chiamate a `LogManager.shutdown()`.
2. **Refactoring Batch tramite Sub-Agent (per codebase ampie):**
   - Se il progetto include decine di classi, delega a `@generalist` il refactoring per sottomodulo, chiedendo di compilare con `mvn test-compile` e riportare solo l'esito.
3. **Verifica & Build Gate:**
   - Esegui: `mvn clean install -DskipTests` (o `mvn test-compile`).
   - *Gate Step 4 (Pausa):* Presenta la sintesi delle classi modificate e l'esito della compilazione. Se emergono errori di compilazione, risolvili, rilancia `mvn clean install` e richiedi conferma allo sviluppatore.
   - *Commit Atomico (dopo approvazione):*
     `git add **/*.java && git commit -m "refactor(logging): migrate Java code to native Log4j 2 LogManager and ThreadContext"`

*Riferimento dettagliato: consulta `references/api-mappings.md`.*

---

### STEP 5: Custom Component Rewrite
*(Da eseguire solo se nello Step 1 sono stati individuati componenti che estendono `AppenderSkeleton`, `Layout` o `Filter`)*
1. **Analisi e Sostituzione:**
   - Valuta se la funzionalità è già coperta da plugin nativi di Log4j 2 (`JsonTemplateLayout`, `AsyncAppender`, `RoutingAppender`).
2. **Riscrittura Nativa:**
   - Riscrivi il componente estendendo `AbstractAppender`.
   - Decora con `@Plugin(name = "...", category = Node.CORE, elementType = Appender.ELEMENT_TYPE)`.
   - Implementa il pattern `@PluginBuilderFactory` con builder statico.
3. **Verifica & Build Gate:**
   - Esegui: `mvn clean install`.
   - *Gate Step 5 (Pausa):* Mostra il nuovo codice del plugin e l'esito della compilazione allo sviluppatore. Itera se necessario.
   - *Commit Atomico (dopo approvazione):*
     `git add **/*.java && git commit -m "feat(logging): migrate custom appenders to Log4j 2 @Plugin architecture"`

*Riferimento dettagliato: consulta `references/custom-plugins.md`.*

---

### STEP 5.bis: Agentic Code Review Gate (`/code-review`)
1. **Verifica Estensione Code Review:**
   - Assicurarsi che l'estensione `code-review` sia installata (`gemini extensions install https://github.com/gemini-cli-extensions/code-review` o `npm run install-code-review`).
2. **Esecuzione Code Review sul Branch Locale:**
   - Esegui (o invita lo sviluppatore a lanciare):
     ```text
     /code-review
     ```
   - Focus prioritario:
     - Assoluta assenza di residui `org.apache.log4j.*`.
     - Rispetto del logging parametrizzato (nessuna concatenazione inutile `+`).
     - Corretto passaggio dell'eccezione come ultimo argomento in `LOGGER.error("...", ex)`.
     - Corretto utilizzo di `ThreadContext` e rilascio delle risorse.
3. **Risoluzione Rilievi & Re-Build:**
   - Correggi chirurgicamente eventuali rilievi critici emersi dalla review.
   - Riesegui sempre `mvn clean install` per verificare che la build resti verde.
4. **Gate Step 5.bis (Pausa):** Presenta l'esito della code review e le eventuali correzioni allo sviluppatore. Procedi allo Step 6 solo dopo approvazione esplicita.

---

### STEP 6: Build, Packaging & Final Verification
1. **Esecuzione Test Completi:**
   - Esegui:
     ```bash
     mvn clean install
     ```
   - Verifica che tutti i test unitari e di integrazione passino. In caso di fallimenti, diagnostica con `@generalist` e correggi.
2. **Generazione e Ispezione Pacchetti Deployabili:**
   - Esegui:
     ```bash
     mvn clean package
     ```
   - Ispeziona il pacchetto finale (`target/*.war` o `target/*.jar`):
     - Verifica la presenza di `log4j2.xml` in `WEB-INF/classes/` o alla radice.
     - Verifica che `log4j-api` e `log4j-core` siano presenti in `WEB-INF/lib/`.
     - Verifica l'assoluta assenza di `log4j-1.2.*.jar` o `reload4j-*.jar`.
3. **Gate Finale & Integrazione Git (Protezione Assoluta di `main` / `master`):**
   - **Nessun merge automatico:** È fatto assoluto divieto di merge automatico o push diretto su `main` o `master`.
   - **Opzione 1 (Consigliata):** Spinta del branch (`git push -u origin migration/log4j2`) e predisposizione del template per la Pull Request per la revisione del team.
   - **Opzione 2 (Merge Locale):** Solo se espressamente richiesto dallo sviluppatore, l'agente mostra il log dei commit, chiede autorizzazione esplicita ("*Confermi il merge su main?*") ed esegue il merge **solo dopo la conferma affermativa dell'utente**.

*Riferimento dettagliato: consulta `references/pitfalls.md`.*
