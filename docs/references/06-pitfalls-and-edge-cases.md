# 06. Risoluzione Errori & Edge Cases (Troubleshooting)

Questa guida raccoglie i trabocchetti più frequenti, i conflitti di classpath e gli errori di runtime che possono emergere durante o dopo la migrazione da Log4j 1 a Log4j 2, fornendo soluzioni concrete per ciascuno scenario.

---

## 1. Conflitti di Classpath e Binding SLF4J

### Sintomo: Avviso "Class path contains multiple SLF4J bindings"
All'avvio dell'applicazione la console mostra:
```text
SLF4J: Class path contains multiple SLF4J bindings.
SLF4J: Found binding in [jar:file:.../slf4j-log4j12-1.7.30.jar!/org/slf4j/impl/StaticLoggerBinder.class]
SLF4J: Found binding in [jar:file:.../log4j-slf4j2-impl-2.24.1.jar!/...]
SLF4J: See http://www.slf4j.org/codes.html#multiple_bindings for an explanation.
```
* **Causa:** Nel classpath coesistono sia il vecchio binder di Log4j 1 (`slf4j-log4j12` o `slf4j-reload4j`), sia il nuovo provider Log4j 2 (`log4j-slf4j2-impl`).
* **Soluzione:** Escludere `slf4j-log4j12` da tutte le dipendenze Maven che lo importano transitivamente:
  ```xml
  <exclusion>
      <groupId>org.slf4j</groupId>
      <artifactId>slf4j-log4j12</artifactId>
  </exclusion>
  ```

---

## 2. Errori di Inizializzazione e Assenza di Log (Silent Failure)

### Sintomo: L'applicazione parte ma non viene prodotto alcun log
Non appare nessun messaggio, nemmeno a console, oppure i file di log restano vuoti.
* **Causa 1 (File XML Malformato):** C'è un errore di sintassi in `log4j2.xml`. Per impostazione predefinita, Log4j 2 gestisce gli errori interni senza bloccare l'applicazione (fail-safe).
* **Soluzione 1 (Attivare lo Status Logger):**
  Modificare temporaneamente la prima riga di `log4j2.xml` impostando `status="TRACE"`:
  ```xml
  <Configuration status="TRACE">
  ```
  All'avvio, Log4j 2 stamperà a console tutto il caricamento dei file, indicando l'attributo errato o il plugin non trovato.
* **Causa 2 (Posizionamento Errato):** Il file `log4j2.xml` è stato salvato in una cartella non inclusa nel classpath (es. `src/` generico o fuori da `src/main/resources`).
* **Soluzione 2:** Assicurarsi che `log4j2.xml` sia esattamente in `src/main/resources/log4j2.xml`.

---

## 3. Lookups Non Risolti (Variabili `${...}`)

### Sintomo: I file di log vengono creati con nomi letterali come `${catalina.base}/logs/app.log`
* **Causa:** In Log4j 1 bastava scrivere `${mia.proprieta}`. In Log4j 2 la sintassi richiede il prefisso del Lookup plugin.
* **Soluzione:** Aggiungere il prefisso corretto:
  * Proprietà di sistema (`-D`): `${sys:catalina.base}`
  * Variabili d'ambiente: `${env:CATALINA_HOME}`
  * Con valore di fallback: `${sys:catalina.base:-/var/log}/app.log`

---

## 4. Errori di Runtime: `ClassNotFoundException: org.apache.log4j.Logger`

### Sintomo: L'applicazione compila ma va in crash a runtime su chiamate di terze parti
```text
java.lang.NoClassDefFoundError: org/apache/log4j/Logger
    at com.terzaparte.legacy.Helper.logSomething(Helper.java:42)
```
* **Causa:** Anche se hai rifattorizzato tutto il tuo codice interno a Log4j 2, una libreria JAR di terze parti non aggiornabile invoca ancora internamente Log4j 1.x.
* **Soluzione:** Includere il modulo bridge di Log4j 2 `log4j-1.2-api`:
  ```xml
  <dependency>
      <groupId>org.apache.logging.log4j</groupId>
      <artifactId>log4j-1.2-api</artifactId>
      <scope>runtime</scope>
  </dependency>
  ```
  Questo JAR implementa i vecchi package `org.apache.log4j.*` ma reindirizza trasparentemente tutti i log sul motore Log4j 2, senza richiedere il vero `log4j-1.2.jar`.

---

## 5. Conversione della Configurazione Programmatica

### Sintomo: Il codice usa `PropertyConfigurator` o `DOMConfigurator`
In Log4j 1:
```java
PropertyConfigurator.configure("/path/to/log4j.properties"); // VECCHIO
DOMConfigurator.configure("/path/to/log4j.xml");            // VECCHIO
```
In Log4j 2:
Queste classi non esistono nell'API nativa.
* **Soluzione 1 (Inizializzazione con File Esterno):**
  ```java
  import org.apache.logging.log4j.core.config.Configurator;
  import java.net.URI;

  Configurator.initialize(null, "/path/to/log4j2.xml");
  // oppure tramite URI
  Configurator.initialize(null, URI.create("file:///opt/conf/log4j2.xml"));
  ```
* **Soluzione 2 (Configurazione Dinamica in Java):**
  Se la configurazione veniva costruita programmaticamente a runtime, utilizzare l'API `ConfigurationBuilderFactory`:
  ```java
  import org.apache.logging.log4j.core.config.builder.api.ConfigurationBuilder;
  import org.apache.logging.log4j.core.config.builder.api.ConfigurationBuilderFactory;
  import org.apache.logging.log4j.core.config.Configurator;

  ConfigurationBuilder<?> builder = ConfigurationBuilderFactory.newConfigurationBuilder();
  builder.setStatusLevel(Level.ERROR);
  builder.add(builder.newAppender("Stdout", "Console").add(builder.newLayout("PatternLayout").addAttribute("pattern", "%msg%n")));
  Configurator.initialize(builder.build());
  ```

---

## 6. Applicazioni Web (WAR / Servlet Container)

Se l'applicazione viene deployata su Tomcat, Jetty, WildFly o WebLogic:
* **Dipendenza raccomandata:** Includere `log4j-web` nel modulo WAR:
  ```xml
  <dependency>
      <groupId>org.apache.logging.log4j</groupId>
      <artifactId>log4j-web</artifactId>
      <scope>runtime</scope>
  </dependency>
  ```
* **Vantaggio:** Gestisce automaticamente l'inizializzazione del LoggerContext all'avvio del ServletContext e lo spegnimento pulito al undeploy, prevenendo memory leak del classloader.

---

## 7. Verifica di Packaging del Deployable Finale (`mvn clean package`)

Dopo aver compilato l'applicazione con:
```bash
mvn clean package
```
Ispezionare il pacchetto generato per convalidare i requisiti di produzione:

```bash
# Per file WAR
jar -tf target/applicazione.war | grep log4j2.xml
# Output atteso: WEB-INF/classes/log4j2.xml

jar -tf target/applicazione.war | grep "WEB-INF/lib/log4j"
# Output atteso:
# WEB-INF/lib/log4j-api-2.24.1.jar
# WEB-INF/lib/log4j-core-2.24.1.jar
# NESSUN log4j-1.2.* o reload4j!
```
