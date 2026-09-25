# Specifiche di Design: Guida e Skill di Migrazione da Log4j 1.x a Log4j 2.x

## 1. Obiettivo e Sintesi Esecutiva
L'obiettivo di questo progetto è definire, raccogliere e sistematizzare tutte le regole tecniche per la migrazione di applicazioni Java da **Log4j 1.x** (e suoi fork legacy come *reload4j*) alla versione nativa **Log4j 2.x**.

L'approccio scelto è il **Refactoring Nativo**:
- Eliminazione completa delle dipendenze e delle API legacy di Log4j 1.x.
- Adozione dell'API nativa di Log4j 2 (`log4j-api` e `log4j-core`) per logging diretto, con note architetturali per scenari con facciata SLF4J (`log4j-slf4j2-impl`).
- Conversione dei formati di configurazione storici (`log4j.properties`, `log4j.xml`) nel formato canonico `log4j2.xml`.
- Supporto al refactoring assistito tramite ricette automatizzate (OpenRewrite) e conversione guidata dei componenti custom non automatizzabili (Appenders, Layouts, Filters).

Il deliverable si articola su due componenti sincronizzati:
1. **Dossier Tecnico / Playbook nel Workspace (`migration_Log4J2/docs/`)**: Documentazione completa, esaustiva e navigabile per sviluppatori e team di manutenzione.
2. **Skill per Gemini CLI (`~/.gemini/skills/log4j1-to-log4j2-migration/`)**: Modulo procedurale riusabile dall'agente AI per condurre audit, pianificazioni e refactoring su qualsiasi progetto Java in modo deterministico e token-efficient.

---

## 2. Architettura dei File e Struttura Modulare

### 2.1 Workspace Locale (`D:\dev\project\migration_Log4J2\`)
```text
D:\dev\project\migration_Log4J2\
├── README.md
├── docs/
│   ├── MIGRATION_PLAYBOOK.md
│   └── references/
│       ├── 01-dependencies-and-build.md
│       ├── 02-api-and-code-mappings.md
│       ├── 03-configuration-migration.md
│       ├── 04-custom-components.md
│       ├── 05-openrewrite-recipes.md
│       └── 06-pitfalls-and-edge-cases.md
```

### 2.2 Skill Gemini CLI (`D:\Users\YYI5347\.gemini\skills\log4j1-to-log4j2-migration\`)
```text
D:\Users\YYI5347\.gemini\skills\log4j1-to-log4j2-migration\
├── SKILL.md
└── references/
    ├── api-mappings.md
    ├── config-converter.md
    ├── custom-plugins.md
    └── pitfalls.md
```

---

## 3. Specifiche Tecniche delle Regole di Migrazione

### 3.1 Dipendenze e Build (Maven / Gradle)
* **Struttura Multi-Modulo (Maven Parent/Submodules o Gradle Multi-Project):**
  * **Analisi gerarchica:** Rilevare se il progetto è a singolo modulo o multi-modulo (tag `<modules>` nel POM radice, sezioni `include` in `settings.gradle`).
  * **Mappatura delle relazioni:** Mappare la gerarchia dei parent `pom.xml`, l'ereditarietà e i vincoli di `<dependencyManagement>`.
  * **Strategia architetturale per moduli:**
    * **Root/Parent POM:** Dichiarare `log4j-bom` nel `<dependencyManagement>` e definire le esclusioni globali di Log4j 1 / reload4j.
    * **Moduli di Business / Librerie (JAR):** Aggiungere solo la dipendenza da `log4j-api` (scope `compile`). Usare `log4j-core` solo in scope `test` se necessario per i test unitari.
    * **Moduli di Packaging / Runtime (WAR, Spring Boot JAR, EAR, Distribution):** Aggiungere `log4j-core` (scope `runtime` o `compile`) e ospitare il file di configurazione `log4j2.xml`.
* **BOM:** Obbligo di utilizzo di `org.apache.logging.log4j:log4j-bom` nel `<dependencyManagement>` (o `platform(...)` in Gradle) per garantire la coerenza di versione fra moduli.
* **Dipendenze dirette:**
  * `org.apache.logging.log4j:log4j-api` (scope `compile`).
  * `org.apache.logging.log4j:log4j-core` (scope `runtime` per packaging/runtime, `compile` per applicazioni monolitiche).
* **Esclusioni transitive tassative:**
  * Esclusione globale di `log4j:log4j`, `ch.qos.reload4j:reload4j`, `org.slf4j:slf4j-log4j12` e `org.slf4j:log4j-over-slf4j` per evitare conflitti di binding a runtime.
* **Facciata SLF4J (quando richiesta):**
  * Sostituzione di `slf4j-log4j12` con `log4j-slf4j2-impl` (per SLF4J 2.x) o `log4j-slf4j-impl` (per SLF4J 1.7.x legacy).

### 3.2 Mapping API e Refactoring del Codice Java
| Log4j 1.x / reload4j | Log4j 2.x Nativo | Note Operative |
| :--- | :--- | :--- |
| `org.apache.log4j.Logger` | `org.apache.logging.log4j.Logger` | Interfaccia base per il logging |
| `org.apache.log4j.LogManager` | `org.apache.logging.log4j.LogManager` | Factory di gestione dei logger |
| `Logger.getLogger(Foo.class)` | `LogManager.getLogger(Foo.class)` | Factory method corretto |
| `Logger.getRootLogger()` | `LogManager.getRootLogger()` | Recupero del root logger |
| `org.apache.log4j.Category` | `org.apache.logging.log4j.Logger` | `Category` deprecata fin da Log4j 1.2, convertire in `Logger` |
| `org.apache.log4j.Priority` | `org.apache.logging.log4j.Level` | Mappare su `Level` |
| `org.apache.log4j.Level` | `org.apache.logging.log4j.Level` | Mappare su `Level` |
| `Logger.getEffectiveLevel()` | `Logger.getLevel()` | Ritorna il livello effettivo |
| `Logger.setLevel(Level)` | `Configurator.setLevel(name, level)` | Le modifiche di runtime appartengono a `org.apache.logging.log4j.core.config.Configurator` |
| `MDC.put(k, v)` | `ThreadContext.put(k, v)` | Mappa del contesto diagnostico |
| `MDC.get(k)` | `ThreadContext.get(k)` | Lettura del contesto |
| `MDC.remove(k)` | `ThreadContext.remove(k)` | Rimozione chiave |
| `NDC.push(val)` | `ThreadContext.push(val)` | Stack del contesto diagnostico |
| `NDC.pop()` | `ThreadContext.pop()` | Prelievo dallo stack |
| `LogManager.shutdown()` | *Rimosso* | Log4j 2 gestisce automaticamente il shutdown via JVM hook |

#### Logging Parametrizzato (Performance)
* Sostituire concatenazioni costose di stringhe:
  * *Legacy:* `logger.debug("Request ID " + id + " for user " + user);`
  * *Nativo:* `logger.debug("Request ID {} for user {}", id, user);`
* Rimuovere i costrutti di protezione non necessari quando si usa il logging parametrizzato:
  * Eliminare i blocchi `if (logger.isDebugEnabled()) { ... }` a meno che il calcolo degli argomenti stessi non implichi elaborazioni pesanti o chiamate a metodi complessi.

### 3.3 Conversione della Configurazione (`log4j2.xml`)
* **Struttura base del file:**
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <Configuration status="WARN">
      <Appenders>
          <Console name="Console" target="SYSTEM_OUT">
              <PatternLayout pattern="%d{yyyy-MM-dd HH:mm:ss.SSS} [%t] %-5level %logger{36} - %msg%n"/>
          </Console>
      </Appenders>
      <Loggers>
          <Root level="info">
              <AppenderRef ref="Console"/>
          </Root>
      </Loggers>
  </Configuration>
  ```
* **Property Lookups:** Sostituire `${var}` con `${sys:var}` per le system property, o `${env:var}` per le variabili d'ambiente.
* **Rolling Policy e Rollover:**
  * Sostituire `DailyRollingFileAppender` con `<RollingFile>` configurato con `filePattern` contenente token di data (`%d{yyyy-MM-dd}`) e `<TimeBasedTriggeringPolicy/>`.
  * Sostituire `RollingFileAppender` (basato su dimensione) con `<SizeBasedTriggeringPolicy size="10MB"/>`.
  * Applicare `<DefaultRolloverStrategy fileIndex="min"/>` per conservare l'ordinamento numerico di Log4j 1 (dove l'archivio `1` è il più recente).
* **PatternLayout Mappings:**
  * `%p` $\rightarrow$ `%-5level` o `%level`
  * `%m%n` $\rightarrow$ `%msg%n`
  * `%X{key}` $\rightarrow$ `%X{key}` (supportato) o `%properties`
  * `%x` $\rightarrow$ `%x` o `%ndc`

### 3.4 Componenti Custom (Appenders, Layouts, Filters)
* Riconoscere le estensioni da `AppenderSkeleton` o `Layout`.
* Analizzare la fattibilità della sostituzione con componenti standard Log4j 2 (es. `JsonTemplateLayout`, `AsyncAppender`, `ScriptFilter`).
* Se il componente custom deve essere mantenuto:
  * Riscriverlo con l'annotazione `@Plugin(name = "...", category = Node.CORE, elementType = Appender.ELEMENT_TYPE, printObject = true)`.
  * Implementare un `org.apache.logging.log4j.core.config.plugins.PluginBuilderFactory` o `@PluginFactory` con parametri validati.
  * Estendere `AbstractAppender` e implementare `append(LogEvent event)`.

### 3.5 Automazione con OpenRewrite
* Ricetta ufficiale: `org.openrewrite.java.logging.log4j.Log4j1ToLog4j2` (inclusa in `rewrite-logging-frameworks`).
* Ricetta complementare per la parametrizzazione: `org.openrewrite.java.logging.log4j.ParameterizeLog4j2LoggingStatements`.
* Configurazione Maven via `rewrite-maven-plugin`.
* Limitazioni note da evidenziare all'agente e allo sviluppatore: OpenRewrite **non** migra i file di configurazione XML/properties e **non** migra classi che estendono le classi interne di Log4j 1.

---

## 4. Specifiche del Workflow Operativo della Skill (`SKILL.md`)

### 4.1 Protocollo Obbligatorio ad Ogni Step (Gate di Revisione & Loop Iterativo)
La skill opera secondo un principio rigoroso di **Human-in-the-loop**: ogni step del workflow non può considerarsi concluso né può procedere allo step successivo senza una verifica esplicita dello sviluppatore e il superamento della build.

Per ciascuno dei 6 step:
1. **Esecuzione Modifiche:** L'agente applica le modifiche mirate previste per lo step.
2. **Build di Verifica Automatica:** L'agente lancia `mvn clean install` (o compilazione mirata del modulo coinvolto) per verificare che non vi siano rotture sintattiche o di compilazione.
3. **Pausa e Presentazione al Developer (Gate di Revisione):** L'agente mette in pausa il flusso e presenta allo sviluppatore:
   - Sintesi dei file modificati e delle scelte applicate.
   - Esito della build di verifica.
   - Richiesta esplicita di revisione.
4. **Loop di Feedback & Correzione:**
   - Se lo sviluppatore esprime dubbi, evidenzia errori o richiede modifiche esplicite ("non rispetta le mie esigenze, modifica X in Y"):
     - L'agente recepisce il feedback testuale dello sviluppatore.
     - Applica le correzioni richieste alla codebase.
     - Riesegue immediatamente `mvn clean install` per verificare che la build ritorni/resti verde.
     - Ripresenta il risultato aggiornato e si rimette in pausa.
   - Il ciclo itera finché lo sviluppatore non dichiara esplicitamente approvato lo step.
5. **Transizione allo Step Successivo:** Solo dopo l'approvazione formale dello sviluppatore per lo step corrente, l'agente sblocca il passaggio allo step successivo.

### 4.2 I 6 Step Operativi
1. **Step 1 - Audit & Project Topology Analysis:**
   - **Rilevamento struttura di build:** Identificare se il progetto è a singolo modulo o multi-modulo Maven (`<modules>` nel POM radice) / Gradle multi-project (`settings.gradle`).
   - **Mappatura gerarchia POM:** Ispezionare tutti i `pom.xml` del repository, identificando il Parent POM, la sezione `<dependencyManagement>`, le dipendenze ereditate e le relazioni tra i sottomoduli.
   - **Classificazione dei moduli:** Distinguere tra moduli libreria/core (richiedono solo `log4j-api`), moduli web/batch/packaging (richiedono `log4j-core` a runtime) e moduli test.
   - **Rilevamento configurazioni e codice legacy:** Censire file `log4j.properties`/`log4j.xml` (e in quale sottomodulo risiedono), classi con import `org.apache.log4j.*` e componenti custom.
   - *Gate Step 1:* Presentazione della topologia rilevata e della strategia di migrazione pianificata; attesa approvazione/aggiustamenti dello sviluppatore.
2. **Step 2 - Build Configuration:**
   - Aggiorna il Parent POM (`<dependencyManagement>` con BOM Log4j 2 ed esclusioni globali) e i singoli sottomoduli (assegnando `log4j-api` e/o `log4j-core` con lo scope corretto).
   - Esecuzione `mvn clean install -DskipTests` (o compilazione POM).
   - *Gate Step 2:* Presentazione modifiche ai POM, esito build, pausa per revisione/iterazione ed eventuale build correttiva.
3. **Step 3 - Config File Migration:**
   - Crea `log4j2.xml` traducendo appenders, loggers e filtri nel modulo di runtime appropriato. Rimuove o archivia i vecchi file `log4j.properties`/`log4j.xml`.
   - *Gate Step 3:* Presentazione del nuovo `log4j2.xml`, pausa per revisione parametri (rolling policy, log level, layout), iterazione ed eventuale build di verifica.
4. **Step 4 - Java Refactoring:**
   - Esegue la sostituzione degli import, factory methods (`LogManager.getLogger`), classi deprecate (`Category`, `Priority`), contesti diagnostici (`ThreadContext`) e parametrizzazione dei messaggi attraverso tutti i moduli.
   - Esecuzione `mvn clean install` per verificare la compilazione Java e l'assenza di riferimenti a vecchi package.
   - *Gate Step 4:* Presentazione dei refactoring eseguiti, esito compilazione, pausa per revisione/iterazione ed eventuale build correttiva.
5. **Step 5 - Custom Component Rewrite:**
   - Identifica componenti che estendono `AppenderSkeleton` o `Layout` e li riscrive come plugin Log4j 2 con relative annotazioni `@Plugin`.
   - Esecuzione `mvn clean install` per validare il packaging dei plugin Log4j 2.
   - *Gate Step 5:* Presentazione del codice del plugin migrato, pausa per revisione/iterazione ed eventuale build correttiva.
6. **Step 6 - Build, Packaging & Final Verification:**
   - Esecuzione completa di `mvn clean install` con tutti i test di regressione attivi per verificare il comportamento d'insieme.
   - Esecuzione di `mvn clean package` per generare i pacchetti finali deployabili (JAR/WAR/EAR) e verificare l'inclusione corretta di `log4j2.xml` e delle librerie di runtime nei pacchetti finali.
   - *Gate Step 6:* Presentazione del report finale e verifica con lo sviluppatore.

---

## 5. Agent Harness e Tooling di Supporto (Sub-Agents, Sub-Skills e Script)

Per progetti complessi o di grandi dimensioni (es. multi-modulo enterprise con decine di POM e centinaia di classi Java), la skill principale funge da **Orchestratore (Agent Harness)** e delega compiti gravosi o ripetitivi a **Sub-Agent** (`invoke_agent` / `@generalist`, `@codebase_investigator`) e **Sub-Skill** specializzate. In questo modo la sessione principale rimane rapida, snella ed evita l'esaurimento della context-window.

### 5.1 Strategia di Delega a Sub-Agent (Context Window Optimization)
L'agente principale mantiene il controllo del workflow e dei gate di approvazione con lo sviluppatore, ma delega compiti ad alto consumo di token:
1. **Audit & Discovery Sub-Agent (`codebase_investigator`):**
   - Invocato per esplorare l'intero albero delle directory, leggere tutti i `pom.xml`, mappare la gerarchia parent/submodules e individuare tutte le occorrenze di `org.apache.log4j.*`.
   - *Output compresso:* Restituisce all'agente principale solo un report strutturato (topologia moduli, lista file di config, conteggio classi legacy) senza intasare la cronologia con decine di letture di file.
2. **Batch Code Refactoring Sub-Agent (`generalist`):**
   - Invocato su singoli sottomoduli o gruppi di classi per applicare il refactoring Java (import, factory methods, parametrizzazione).
   - Esegue il refactoring isolato, lancia `mvn test-compile` nel modulo di competenza e restituisce all'orchestratore una sintesi delle classi modificate e lo status della compilazione.
3. **Custom Plugin Migration Sub-Agent (`generalist`):**
   - Invocato per analizzare singoli componenti legacy ad alta complessità (es. estensioni custom di `AppenderSkeleton`) e produrre la riscrittura nativa con annotazioni `@Plugin` e `PluginBuilderFactory`.
4. **Diagnostic Sub-Agent (`generalist`):**
   - Invocato in caso di fallimento della build (`mvn clean install` con traceback prolungati). Analizza i log di errore Maven, isola la causa radice (es. conflitto di dipendenze, classi mancanti) e propone all'orchestratore esclusivamente la correzione chirurgica necessaria.

### 5.2 Sub-Skills Specializzate
La skill principale può attivare o consigliare:
- **`openrewrite-runner`:** Sub-skill focalizzata esclusivamente sull'iniezione mirata del plugin `rewrite-maven-plugin` nel POM, esecuzione batch delle ricette OpenRewrite e successiva pulizia del POM.
- **`log4j-custom-plugin-builder`:** Sub-skill contenente i pattern specifici e i template per convertire gli appender da Log4j 1 a Log4j 2.

### 5.3 Script e Hook Custom
L'Harness include script eseguibili (Bash/PowerShell) per l'automazione locale:
- **Scansione AST Veloce:** Script basato su tool di ricerca efficienti per censire istantaneamente gli import legacy.
- **XML Converter Wrapper:** Script helper per invocare il convertitore ufficiale di Apache Log4j per file di configurazione complessi.
- **Git Hooks (Pre-commit):** Hook opzionale che blocca l'inserimento di nuovi import `org.apache.log4j.*` durante la fase di migrazione.

---

## 6. Criteri di Accettazione e Validazione
- [ ] Documentazione nel workspace creata e consultabile (`README.md`, `MIGRATION_PLAYBOOK.md`, `references/*.md`).
- [ ] Skill Gemini CLI creata in `~/.gemini/skills/log4j1-to-log4j2-migration/` con `SKILL.md` valido e file di reference a supporto.
- [ ] Verifica formale che le descrizioni della Skill rispettino gli standard di discovery di Gemini CLI.
- [ ] Validazione di coerenza tecnica tra playbook e skill.
