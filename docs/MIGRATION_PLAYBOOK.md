# Playbook Esecutivo di Migrazione Nativa da Log4j 1.x a Log4j 2.x

## 1. Visione Architetturale e Scopo
Questo playbook definisce il processo formale per condurre la migrazione completa, sicura e nativa di una qualsiasi applicazione Java da **Log4j 1.x** (o fork reload4j) a **Log4j 2.x**.

### Principi Guida:
1. **Refactoring Nativo:** Non facciamo affidamento al bridge di emulazione `log4j-1.2-api` a regime. L'intero codice sorgente dell'applicazione viene aggiornato per invocare le API native di Log4j 2 (`org.apache.logging.log4j`).
2. **Eliminazione Totale del Debito Tecnico:** Tutti gli artefatti `log4j:log4j`, `ch.qos.reload4j:reload4j`, `org.slf4j:slf4j-log4j12` e `org.slf4j:log4j-over-slf4j` vengono banditi ed esclusi dal classpath.
3. **Approccio Multi-Modulo Disciplinato:** Le dipendenze vengono dichiarate centralmente tramite BOM nel Parent POM. La libreria di interfaccia (`log4j-api`) è confinata nei moduli di business logic, mentre il motore runtime (`log4j-core`) e la configurazione risiedono esclusivamente nei moduli di packaging/runtime (WAR, Spring Boot Fat JAR, EAR).
4. **Human-in-the-Loop & Build Gate:** Ogni fase della migrazione si conclude con una verifica formale di build (`mvn clean install`) e con la revisione/approvazione esplicita dello sviluppatore. In caso di osservazioni o errori, si itera finché la build non è verde e lo sviluppatore soddisfatto.

---

## 2. Diagramma del Ciclo di Lavoro a 6 Step

```text
[Step 1: Audit & Topologia Multi-Modulo]
                   ↓
        [Revisione Sviluppatore]
                   ↓
[Step 2: Aggiornamento POM & Build System] → [Build: mvn clean install -DskipTests]
                   ↓
        [Revisione Sviluppatore]
                   ↓
[Step 3: Migrazione File Configurazione]   → [Creazione log4j2.xml]
                   ↓
        [Revisione Sviluppatore]
                   ↓
[Step 4: Refactoring Java & Parametrizzazione] → [Build: mvn clean install]
                   ↓
   [Se presenti componenti custom]
[Step 5: Riscrittura Plugin Custom (@Plugin)] → [Build: mvn clean install]
                   ↓
        [Revisione Sviluppatore]
                   ↓
[Step 6: Packaging & Verifica Finale]      → [mvn clean install + mvn clean package]
```

---

## 3. Guida Dettagliata agli Step Operativi

### STEP 1: Audit & Topologia del Progetto
**Obiettivo:** Mappare la struttura dei moduli, le dipendenze e i punti di impatto senza apportare modifiche distruttive.
1. **Analisi Strutturale:**
   - Verificare se il progetto è a singolo modulo o multi-modulo (tag `<modules>` nel POM radice).
   - Identificare la catena di ereditarietà tra i vari `pom.xml` e la sezione `<dependencyManagement>`.
2. **Classificazione dei Moduli:**
   - **Parent / Root POM:** Dove dichiarare il BOM e le esclusioni globali.
   - **Moduli Business / Librerie (JAR):** Richiedono unicamente `log4j-api`.
   - **Moduli Packaging / Web (WAR, Spring Boot JAR, EAR):** Richiedono `log4j-core` e conterranno `log4j2.xml`.
3. **Censimento Sorgenti & Config:**
   - Localizzare file `log4j.properties` e `log4j.xml` (`src/main/resources`, cartelle di deploy).
   - Contare le classi Java con import `org.apache.log4j.*`.
   - Individuare estensioni di `AppenderSkeleton`, `Layout`, o `Filter`.
4. **Gate di Revisione:** Presentare allo sviluppatore il report di audit e la strategia per modulo. Attendere approvazione.

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
4. **Verifica & Gate:** Presentare il file `log4j2.xml` allo sviluppatore. Raccogliere feedback (livelli, rotazione) e reiterare prima di proseguire.

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
   - Pausa e revisione con lo sviluppatore. In caso di errori di compilazione, intervenire chirurgicamente, rieseguire `mvn clean install` e ripresentare.

---

### STEP 5: Riscrittura dei Componenti Custom (Appenders / Layout)
**Obiettivo:** Convertire eventuali componenti custom legacy nel sistema `@Plugin` di Log4j 2.
1. **Valutazione:** Verificare se il componente legacy (es. formattazione JSON o rotazione particolare) non sia già fornito out-of-the-box da Log4j 2.
2. **Implementazione Plugin Log4j 2:**
   - Estendere `AbstractAppender`.
   - Utilizzare le annotazioni `@Plugin` e implementare una classe interna statica `Builder` con `@PluginBuilderFactory`.
   - Configurare il `log4j-core` annotation processor nel compilatore Java per generare il file `META-INF/org/apache/logging/log4j/core/config/plugins/Log4j2Plugins.dat`.
3. **Verifica & Build Gate:**
   - Eseguire: `mvn clean install`.
   - Pausa e revisione del componente con lo sviluppatore.

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
   - Verificare la presenza di `log4j-api-*.jar` e `log4j-core-*.jar` in `WEB-INF/lib/` (o nel fat jar).
   - Confermare l'assoluta assenza di `log4j-1.2.*.jar` o `reload4j-*.jar`.
3. **Gate Finale:** Presentare il riepilogo conclusivo di migrazione allo sviluppatore per la chiusura dell'attività.
