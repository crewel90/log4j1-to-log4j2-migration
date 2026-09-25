# Playbook Esecutivo di Migrazione Nativa da Log4j 1.x a Log4j 2.x

## 1. Visione Architetturale e Scopo
Questo playbook definisce il processo formale per condurre la migrazione completa, sicura e nativa di una qualsiasi applicazione Java da **Log4j 1.x** (o fork reload4j) a **Log4j 2.x**.

### Principi Guida:
1. **Refactoring Nativo:** Non facciamo affidamento al bridge di emulazione `log4j-1.2-api` a regime. L'intero codice sorgente dell'applicazione viene aggiornato per invocare le API native di Log4j 2 (`org.apache.logging.log4j`).
2. **Eliminazione Totale del Debito Tecnico:** Tutti gli artefatti `log4j:log4j`, `ch.qos.reload4j:reload4j`, `org.slf4j:slf4j-log4j12` e `org.slf4j:log4j-over-slf4j` vengono banditi ed esclusi dal classpath.
3. **Approccio Multi-Modulo Disciplinato:** Le dipendenze vengono dichiarate centralmente tramite BOM nel Parent POM. La libreria di interfaccia (`log4j-api`) è confinata nei moduli di business logic, mentre il motore runtime (`log4j-core`) e la configurazione risiedono esclusivamente nei moduli di packaging/runtime (WAR, Spring Boot Fat JAR, EAR).
4. **Human-in-the-Loop & Build Gate:** Ogni fase della migrazione si conclude con una verifica formale di build (`mvn clean install`) e con la revisione/approvazione esplicita dello sviluppatore. In caso di osservazioni o errori, si itera finché la build non è verde e lo sviluppatore soddisfatto.
5. **Git Safety & Protezione dei Branch Principali (`main` / `master`):** Nessuna modifica viene apportata direttamente su `main` o `master`. Si opera esclusivamente su branch dedicati (`migration/log4j2`). È fatto assoluto divieto di merge automatico verso i branch protetti: l'integrazione richiede obbligatoriamente Pull Request oppure esplicita autorizzazione formale per il merge locale.

---

## 2. Diagramma del Ciclo di Lavoro

```text
[Step 0: Branching Git dedicato (migration/log4j2)]
                   ↓
[Step 1: Audit, Topologia & Installazione Pre-commit Hook]
                   ↓
        [Revisione Sviluppatore]
                   ↓
[Step 2: Aggiornamento POM] → [Build: mvn clean install -DskipTests] → [Commit: build(deps)...]
                   ↓
        [Revisione Sviluppatore]
                   ↓
[Step 3: Migrazione Config]  → [Creazione log4j2.xml]               → [Commit: chore(logging)...]
                   ↓
        [Revisione Sviluppatore]
                   ↓
[Step 4: Refactoring Java]   → [Build: mvn clean install]            → [Commit: refactor(logging)...]
                   ↓
   [Se presenti componenti custom]
[Step 5: Riscrittura Plugin] → [Build: mvn clean install]            → [Commit: feat(logging)...]
                   ↓
        [Revisione Sviluppatore]
                   ↓
[Step 5.bis: Code Review Agentica (/code-review)] → [Fix rilievi + mvn clean install]
                   ↓
        [Revisione Sviluppatore]
                   ↓
[Step 6: Packaging & Verifica Finale] → [mvn clean install + mvn clean package]
                   ↓
[Gate Integrazione Git: Pull Request (consigliata) OPPURE Merge Locale SOLO PREVIA APPROVAZIONE ESPLICITA]
```

---

## 3. Guida Dettagliata agli Step Operativi

### STEP 0: Inizializzazione Git & Branching
**Obiettivo:** Isolare le modifiche e proteggere `main`/`master`.
1. Verificare che l'albero sia pulito con `git status`.
2. Creare un branch dedicato: `git checkout -b migration/log4j2`.
3. **Divieto assoluto di lavorare direttamente sui branch di produzione (`main` / `master`).**

---

### STEP 1: Audit & Topologia del Progetto
**Obiettivo:** Mappare la struttura dei moduli, le dipendenze e attivare le protezioni locali.
1. **Installazione Hook Pre-Commit:**
   Copiare l'hook dell'harness nel repository target per impedire nuovi import legacy:
   ```bash
   cp .gemini/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
   ```
2. **Analisi Strutturale:**
   - Verificare se il progetto è a singolo modulo o multi-modulo (tag `<modules>` nel POM radice).
   - Identificare la catena di ereditarietà tra i vari `pom.xml` e la sezione `<dependencyManagement>`.
3. **Classificazione dei Moduli:**
   - **Parent / Root POM:** Dove dichiarare il BOM e le esclusioni globali.
   - **Moduli Business / Librerie (JAR):** Richiedono unicamente `log4j-api`.
   - **Moduli Packaging / Web (WAR, Spring Boot JAR, EAR):** Richiedono `log4j-core` e conterranno `log4j2.xml`.
4. **Censimento Sorgenti & Config:**
   - Eseguire lo scanner rapido: `powershell -File .gemini/scripts/scan-legacy-log4j.ps1` (o `./.gemini/scripts/scan-legacy-log4j.sh`).
   - Localizzare file `log4j.properties` e `log4j.xml` (`src/main/resources`, cartelle di deploy).
   - Contare le classi Java con import `org.apache.log4j.*`.
   - Individuare estensioni di `AppenderSkeleton`, `Layout`, o `Filter`.
5. **Gate di Revisione:** Presentare allo sviluppatore il report di audit e la strategia per modulo. Attendere approvazione.

---

### STEP 2: Aggiornamento del Build System (Maven / Gradle)
**Obiettivo:** Introdurre le librerie Log4j 2 e rimuovere ogni riferimento a Log4j 1.
1. **Parent POM (`<dependencyManagement>`):**
   ```xml
   <dependencyManagement>
       <dependencies>
           <dependency>
               <groupId>org.apache.logging.log4j</groupId>
               <artifactId>log4j-bom</artifactId>
               <version>2.24.1</version>
               <type>pom</type>
               <scope>import</scope>
           </dependency>
       </dependencies>
   </dependencyManagement>
   ```
2. **Moduli Business / Core:**
   ```xml
   <dependency>
       <groupId>org.apache.logging.log4j</groupId>
       <artifactId>log4j-api</artifactId>
   </dependency>
   ```
3. **Moduli Packaging / Runtime:**
   ```xml
   <dependency>
       <groupId>org.apache.logging.log4j</groupId>
       <artifactId>log4j-core</artifactId>
       <scope>runtime</scope>
   </dependency>
   ```
4. **Esclusioni Globali:** Aggiungere blocchi `<exclusion>` su dipendenze terze che portano transitivamente `log4j:log4j` o `reload4j`.
5. **Verifica & Build Gate:**
   - Eseguire: `mvn dependency:tree -Dincludes=log4j:*,ch.qos.reload4j:*`
   - Eseguire: `mvn clean install -DskipTests`
   - *Pausa e Revisione:* Presentare il diff dei POM allo sviluppatore. Se richiesto, applicare correzioni e rieseguire la build.
   - *Commit Atomico:* Solo dopo approvazione formale:
     `git add **/pom.xml && git commit -m "build(deps): migrate dependencies to Log4j 2 BOM and exclude legacy log4j1"`

---

### STEP 3: Migrazione della Configurazione (`log4j2.xml`)
**Obiettivo:** Convertire i vecchi file di proprietà o XML in file `log4j2.xml` moderni e stabili.
1. **Posizionamento:** Il file `log4j2.xml` deve risiedere in `src/main/resources/` del modulo di runtime (in modo da finire alla radice del classpath dell'applicazione impacchettata).
2. **Struttura Canonica:**
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <Configuration status="WARN" monitorInterval="30">
       <Properties>
           <Property name="LOG_DIR">${sys:catalina.base:-logs}/logs</Property>
       </Properties>
       <Appenders>
           <Console name="Console" target="SYSTEM_OUT">
               <PatternLayout pattern="%d{yyyy-MM-dd HH:mm:ss.SSS} [%t] %-5level %logger{36} - %msg%n"/>
           </Console>
           <RollingFile name="AppFile" fileName="${LOG_DIR}/application.log"
                        filePattern="${LOG_DIR}/application-%d{yyyy-MM-dd}-%i.log.gz">
               <PatternLayout pattern="%d{yyyy-MM-dd HH:mm:ss.SSS} [%t] %-5level %logger{36} - %msg%n"/>
               <Policies>
                   <TimeBasedTriggeringPolicy/>
                   <SizeBasedTriggeringPolicy size="50MB"/>
               </Policies>
               <DefaultRolloverStrategy fileIndex="min" max="30"/>
           </RollingFile>
       </Appenders>
       <Loggers>
           <Root level="INFO">
               <AppenderRef ref="Console"/>
               <AppenderRef ref="AppFile"/>
           </Root>
       </Loggers>
   </Configuration>
   ```
3. **Regole Fondamentali di Traduzione:**
   - Usare sempre `${sys:property}` per le variabili passate con `-D` (in Log4j 1 bastava `${property}`).
   - Impostare `<DefaultRolloverStrategy fileIndex="min"/>` per mantenere l'indicizzazione legacy.
   - Eliminare o rinominare i vecchi `log4j.properties` o `log4j.xml` per evitare ambiguità.
4. **Verifica & Gate:**
   - Presentare il file `log4j2.xml` allo sviluppatore. Raccogliere feedback (livelli, rotazione) e reiterare.
   - *Commit Atomico:* Solo dopo approvazione formale:
     `git add **/log4j2.xml && git commit -m "chore(logging): convert log4j configuration to canonical log4j2.xml"`

---

### STEP 4: Refactoring del Codice Java
**Obiettivo:** Aggiornare tutte le classi Java all'API nativa di Log4j 2.
1. **Sostituzione Import & Logger:**
   ```java
   // VECCHIO (Log4j 1)
   import org.apache.log4j.Logger;
   import org.apache.log4j.LogManager;
   Logger logger = Logger.getLogger(MyService.class);

   // NUOVO (Log4j 2 Nativo)
   import org.apache.logging.log4j.Logger;
   import org.apache.logging.log4j.LogManager;
   private static final Logger LOGGER = LogManager.getLogger(MyService.class);
   ```
2. **MDC / NDC $\rightarrow$ ThreadContext:**
   ```java
   // VECCHIO
   MDC.put("userId", userId);
   NDC.push("tx123");

   // NUOVO
   ThreadContext.put("userId", userId);
   ThreadContext.push("tx123");
   ```
3. **Logging Parametrizzato (Performance Boost):**
   ```java
   // VECCHIO (Concatenazione pesante)
   if (logger.isDebugEnabled()) {
       logger.debug("Elaborazione ordine " + orderId + " per utente " + user);
   }

   // NUOVO (Parametrizzato pulito)
   LOGGER.debug("Elaborazione ordine {} per utente {}", orderId, user);
   ```
4. **Rimozione Shutdown:** Rimuovere qualsiasi invocazione di `LogManager.shutdown()`.
5. **Verifica & Build Gate:**
   - Eseguire: `mvn clean install -DskipTests` (verifica compilazione su tutti i moduli).
   - Pausa e revisione con lo sviluppatore. In caso di errori, applicare fix, rieseguire la build e ripresentare.
   - *Commit Atomico:* Solo dopo approvazione formale:
     `git add **/*.java && git commit -m "refactor(logging): migrate Java code to native Log4j 2 LogManager and ThreadContext"`

---

### STEP 5: Riscrittura dei Componenti Custom (Appenders / Layout)
**Obiettivo:** Convertire eventuali componenti custom legacy nel sistema `@Plugin` di Log4j 2.
1. **Valutazione:** Verificare se il componente legacy non sia già fornito out-of-the-box da Log4j 2.
2. **Implementazione Plugin Log4j 2:**
   - Estendere `AbstractAppender`.
   - Utilizzare le annotazioni `@Plugin` e implementare una classe interna statica `Builder` con `@PluginBuilderFactory`.
   - Configurare il `log4j-core` annotation processor nel compilatore Java per generare il file `META-INF/org/apache/logging/log4j/core/config/plugins/Log4j2Plugins.dat`.
3. **Verifica & Build Gate:**
   - Eseguire: `mvn clean install`.
   - Pausa e revisione del componente con lo sviluppatore.
   - *Commit Atomico:* Solo dopo approvazione formale:
     `git add **/*.java && git commit -m "feat(logging): migrate custom appenders to Log4j 2 @Plugin architecture"`

---

### STEP 5.bis: Code Review Agentica (`/code-review`)
**Obiettivo:** Effettuare una revisione automatizzata e rigorosa dei diff e del codice sorgente sul branch di migrazione prima del packaging finale.
1. **Prerequisito:** Estensione ufficiale Gemini CLI [`code-review`](https://github.com/gemini-cli-extensions/code-review) installata (`npm run install-code-review` o `gemini extensions install https://github.com/gemini-cli-extensions/code-review`).
2. **Esecuzione della Code Review:**
   Lanciare sul branch locale:
   ```text
   /code-review
   ```
   Fornendo come focus di review:
   *"Revisione del refactoring da Log4j 1 a Log4j 2: verificare assenza totale di import legacy org.apache.log4j.*, corretto uso del logging parametrizzato con placeholder {}, corretta gestione di ThreadContext ed eccezioni Throwable."*
3. **Valutazione & Risoluzione dei Rilievi:**
   - **Rilievi Critici / Bug:** Risoluzione immediata da parte dell'agente o dello sviluppatore.
   - **Riesecuzione Build:** Dopo qualsiasi correzione, lanciare sempre `mvn clean install` per verificare che la build resti verde.
4. **Gate di Revisione:** Lo sviluppatore esamina l'esito della code review e convalida il superamento dello step.

---

### STEP 6: Packaging, Test di Regressione & Validazione Finale
**Obiettivo:** Verificare il corretto funzionamento end-to-end, l'assenza di regressioni e il packaging per il deployment.
1. **Build & Test Completi:**
   ```bash
   mvn clean install
   ```
   Verificare che tutte le suite di test passino e che i logger producano output senza avvisi di binding mancanti o collisioni.
2. **Generazione Pacchetti di Deploy:**
   ```bash
   mvn clean package
   ```
   Ispezionare gli artefatti prodotti (es. `target/*.war`, `target/*.jar`):
   - Verificare la presenza di `log4j2.xml` nella directory radice o in `WEB-INF/classes/`.
   - Verificare la presenza di `log4j-api-*.jar` e `log4j-core-*.jar` in `WEB-INF/lib/`.
   - Confermare l'assoluta assenza di `log4j-1.2.*.jar` o `reload4j-*.jar`.
3. **Gate Finale & Integrazione Git (Protezione Assoluta di `main` / `master`):**
   - **Nessun merge automatico:** È fatto assoluto divieto di merge o push diretto non autorizzato su `main`/`master`.
   - **Opzione 1 (Consigliata):** Push del branch `git push -u origin migration/log4j2` e apertura della Pull Request per la code review del team.
   - **Opzione 2 (Merge Locale):** Solo se espressamente richiesto dallo sviluppatore, l'agente mostra i commit, chiede conferma esplicita e solo dopo autorizzazione esegue `git checkout main && git merge --no-ff migration/log4j2`.
