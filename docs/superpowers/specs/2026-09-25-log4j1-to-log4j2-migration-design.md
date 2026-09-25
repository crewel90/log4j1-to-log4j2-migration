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

La skill `log4j1-to-log4j2-migration` definisce un protocollo a 6 step che l'agente esegue in ordine:
1. **Audit & Project Topology Analysis:**
   - **Rilevamento struttura di build:** Identificare se il progetto è a singolo modulo o multi-modulo Maven (`<modules>` nel POM radice) / Gradle multi-project (`settings.gradle`).
   - **Mappatura gerarchia POM:** Ispezionare tutti i `pom.xml` del repository, identificando il Parent POM, la sezione `<dependencyManagement>`, le dipendenze ereditate e le relazioni tra i sottomoduli.
   - **Classificazione dei moduli:** Distinguere tra moduli libreria/core (richiedono solo `log4j-api`), moduli web/batch/packaging (richiedono `log4j-core` a runtime) e moduli test.
   - **Rilevamento configurazioni e codice legacy:** Censire file `log4j.properties`/`log4j.xml` (e in quale sottomodulo risiedono), classi con import `org.apache.log4j.*` e componenti custom.
2. **Build Configuration:** Aggiorna il Parent POM (`<dependencyManagement>` con BOM Log4j 2 ed esclusioni globali) e i singoli sottomoduli (assegnando `log4j-api` e/o `log4j-core` con lo scope corretto).
3. **Config File Migration:** Crea `log4j2.xml` traducendo appenders, loggers e filtri nel modulo di runtime appropriato. Rimuove o archivia i vecchi file `log4j.properties`/`log4j.xml`.
4. **Java Refactoring:** Esegue la sostituzione degli import, factory methods (`LogManager.getLogger`), classi deprecate (`Category`, `Priority`), contesti diagnostici (`ThreadContext`) e parametrizzazione dei messaggi attraverso tutti i moduli.
5. **Custom Component Rewrite:** Identifica componenti che estendono `AppenderSkeleton` e li riscrive come plugin Log4j 2.
6. **Build & Test Verification:** Lancia la build del progetto (`mvn clean test` o `gradle test` sull'intero albero di moduli o sui singoli moduli modificati) per verificare l'assenza di errori di compilazione e la corretta emissione dei log.

---

## 5. Criteri di Accettazione e Validazione
- [ ] Documentazione nel workspace creata e consultabile (`README.md`, `MIGRATION_PLAYBOOK.md`, `references/*.md`).
- [ ] Skill Gemini CLI creata in `~/.gemini/skills/log4j1-to-log4j2-migration/` con `SKILL.md` valido e file di reference a supporto.
- [ ] Verifica formale che le descrizioni della Skill rispettino gli standard di discovery di Gemini CLI.
- [ ] Validazione di coerenza tecnica tra playbook e skill.
