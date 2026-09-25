# 05. Automazione con OpenRewrite

OpenRewrite è un potente motore di refactoring basato sull'albero sintattico (LST - Lossless Syntax Tree) del codice Java. Permette di automatizzare gran parte della riscrittura del codice da Log4j 1 a Log4j 2 senza alterare la formattazione e lo stile originario del progetto.

---

## 1. Le Ricette di Riferimento

Le ricette per il logging risiedono nell'artefatto:
* **Artifact:** `org.openrewrite.recipe:rewrite-logging-frameworks`

### 1.1 `org.openrewrite.java.logging.log4j.Log4j1ToLog4j2`
Questa ricetta automatizza:
1. **Package & Import:** Conversione di `org.apache.log4j.*` in `org.apache.logging.log4j.*`.
2. **Factory Methods:** Conversione di `Logger.getLogger(...)` e `Category.getInstance(...)` in `LogManager.getLogger(...)`.
3. **Root Logger:** Conversione di `Logger.getRootLogger()` in `LogManager.getRootLogger()`.
4. **Metodi di Livello:** Conversione di `getEffectiveLevel()` in `getLevel()`.
5. **Rimozione Shutdown:** Rimozione automatica delle chiamate a `LogManager.shutdown()`.
6. **MDC / NDC:** Conversione di base verso `ThreadContext`.

### 1.2 `org.openrewrite.java.logging.log4j.ParameterizeLog4j2LoggingStatements`
Questa ricetta complementare:
1. Converte le concatenazioni di stringhe all'interno delle chiamate di log (es. `logger.info("Messaggio: " + val)`) in messaggi parametrizzati (`logger.info("Messaggio: {}", val)`).
2. Rimuove i blocchi `if (logger.isDebugEnabled())` divenuti inutili.

---

## 2. Esecuzione Immediata da Riga di Comando (Senza Modificare il POM)

È possibile lanciare OpenRewrite direttamente tramite Maven CLI senza dover aggiungere manualmente il plugin al `pom.xml`:

### Passo 1: Dry-Run (Generazione Diff senza modificare i file)
```bash
mvn org.openrewrite.maven:rewrite-maven-plugin:dryRun \
    -Drewrite.recipeArtifactCoordinates=org.openrewrite.recipe:rewrite-logging-frameworks:RELEASE \
    -Drewrite.activeRecipes=org.openrewrite.java.logging.log4j.Log4j1ToLog4j2,org.openrewrite.java.logging.log4j.ParameterizeLog4j2LoggingStatements
```
Questo comando genererà un file di patch/diff in `target/rewrite/rewrite.patch` per ispezionare le modifiche proposte.

### Passo 2: Esecuzione Effettiva del Refactoring
```bash
mvn org.openrewrite.maven:rewrite-maven-plugin:run \
    -Drewrite.recipeArtifactCoordinates=org.openrewrite.recipe:rewrite-logging-frameworks:RELEASE \
    -Drewrite.activeRecipes=org.openrewrite.java.logging.log4j.Log4j1ToLog4j2,org.openrewrite.java.logging.log4j.ParameterizeLog4j2LoggingStatements
```
Tutti i file `.java` del progetto (inclusi tutti i sottomoduli Maven) verranno riscritti istantaneamente.

---

## 3. Configurazione Dichiarativa nel Parent POM (Opzionale)

Se preferisci configurare il plugin in modo stabile nel `pom.xml` radice:

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.openrewrite.maven</groupId>
            <artifactId>rewrite-maven-plugin</artifactId>
            <version>5.43.0</version>
            <configuration>
                <activeRecipes>
                    <recipe>org.openrewrite.java.logging.log4j.Log4j1ToLog4j2</recipe>
                    <recipe>org.openrewrite.java.logging.log4j.ParameterizeLog4j2LoggingStatements</recipe>
                </activeRecipes>
            </configuration>
            <dependencies>
                <dependency>
                    <groupId>org.openrewrite.recipe</groupId>
                    <artifactId>rewrite-logging-frameworks</artifactId>
                    <version>2.19.0</version>
                </dependency>
            </dependencies>
        </plugin>
    </plugins>
</build>
```

In tal caso i comandi si semplificano in:
```bash
mvn rewrite:dryRun
mvn rewrite:run
```

---

## 4. Limitazioni Intrinseche di OpenRewrite

È fondamentale essere consapevoli di ciò che OpenRewrite **NON PUÒ FARE**:

1. **NON converte i file di configurazione:** OpenRewrite non tocca `log4j.properties` né `log4j.xml`. La creazione di `log4j2.xml` deve essere effettuata manualmente o con il convertitore Apache.
2. **NON riscrive componenti custom:** Se una classe Java estende `AppenderSkeleton`, `Layout` o `Filter`, OpenRewrite non è in grado di convertirla e lascerà il codice non compilabile. Questi componenti devono essere gestiti seguendo la guida *04. Riscrivere Componenti Custom*.
3. **NON gestisce la configurazione programmatica complessa:** Chiamate come `DOMConfigurator.configure(...)` o `PropertyConfigurator.configure(...)` non vengono convertite.
4. **NON risolve le dipendenze transitive legacy:** È sempre necessario escludere `log4j:log4j` dalle dipendenze di terze parti nel `pom.xml`.

---

## 5. Validazione Post-Esecuzione

Subito dopo aver eseguito `mvn rewrite:run`:
```bash
# 1. Controlla le modifiche applicate con git
git status
git diff

# 2. Verifica che la compilazione e i test passino
mvn clean install -DskipTests
```
