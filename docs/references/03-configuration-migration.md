# 03. Migrazione dei File di Configurazione

Questa guida descrive il processo di conversione dai formati di configurazione storici di Log4j 1.x (`log4j.properties` e `log4j.xml`) al formato canonico moderno di Log4j 2.x (`log4j2.xml`).

---

## 1. Regole Fondamentali di Sintassi

### 1.1 Elemento Radice e Status Logger
In Log4j 1 l'elemento radice era `<log4j:configuration>`. In Log4j 2 è `<Configuration>`.
* **Status Logger:** Configurare sempre `status="WARN"` sull'elemento `<Configuration>` per evitare che Log4j 2 stampi a console l'intero processo di inizializzazione interna (a meno che non si stia facendo troubleshooting).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="WARN" monitorInterval="30">
    <!-- Appenders e Loggers -->
</Configuration>
```
*`monitorInterval="30"`* indica a Log4j 2 di ricaricare automaticamente la configurazione se il file viene modificato sul filesystem (in secondi).

### 1.2 Sintassi dei Lookups (Sostituzione Variabili)
Uno dei trabocchetti più insidiosi nella migrazione da Log4j 1 a Log4j 2 riguarda la risoluzione delle variabili `${...}`:
* **In Log4j 1:** `${catalina.base}` risolveva direttamente le System Property passate con `-Dcatalina.base=...`.
* **In Log4j 2:** È **obbligatorio** specificare il prefisso del Lookup plugin:
  * **System Property (`-D`):** `${sys:catalina.base}`
  * **Variabile d'ambiente OS:** `${env:CATALINA_HOME}`
  * **Valore di fallback:** `${sys:catalina.base:-/var/log/app}` (se non impostata, usa il default dopo `:-`).

---

## 2. Matrice di Conversione degli Appender

| Appender Log4j 1.x | Tag Log4j 2.x | Elementi Chiave di Configurazione |
| :--- | :--- | :--- |
| `org.apache.log4j.ConsoleAppender` | `<Console>` | `target="SYSTEM_OUT"` o `SYSTEM_ERR` |
| `org.apache.log4j.FileAppender` | `<File>` | `fileName="..."`, `append="true"` |
| `org.apache.log4j.RollingFileAppender` | `<RollingFile>` | `filePattern="...-%i.log"`, `<SizeBasedTriggeringPolicy>` |
| `org.apache.log4j.DailyRollingFileAppender` | `<RollingFile>` | `filePattern="...-%d{yyyy-MM-dd}.log"`, `<TimeBasedTriggeringPolicy>` |
| `org.apache.log4j.AsyncAppender` | `<Async>` | `<AppenderRef ref="..."/><blocking="true"/>` |
| `org.apache.log4j.net.SMTPAppender` | `<SMTP>` | Invio alert email su eventi ERROR |
| `org.apache.log4j.jdbc.JDBCAppender` | `<JDBC>` | Connessione a DataSource o ConnectionFactory |

---

## 3. Strategie di Rollover e Indicizzazione dei File

In Log4j 1 e Log4j 2 il calcolo degli indici durante la rotazione dei file è invertito per impostazione predefinita:
* **Log4j 1:** Rinomina il file più recente ad indice `1` (`app.log.1`), facendo scalare i precedenti (`app.log.2`, `app.log.3`...).
* **Log4j 2 (default):** Assegna l'indice più alto disponibile al file appena ruotato.

### Come Preservare il Comportamento di Log4j 1:
Configurare esplicitamente `<DefaultRolloverStrategy fileIndex="min"/>`:

```xml
<RollingFile name="RollingLog" fileName="logs/app.log"
             filePattern="logs/app-%d{yyyy-MM-dd}-%i.log.gz">
    <PatternLayout pattern="%d{yyyy-MM-dd HH:mm:ss.SSS} [%t] %-5level %logger{36} - %msg%n"/>
    <Policies>
        <!-- Rotazione giornaliera -->
        <TimeBasedTriggeringPolicy interval="1" modulate="true"/>
        <!-- Rotazione dimensionale oltre i 50MB -->
        <SizeBasedTriggeringPolicy size="50MB"/>
    </Policies>
    <!-- fileIndex="min" garantisce la compatibilità con i pattern Log4j 1 -->
    <DefaultRolloverStrategy fileIndex="min" max="20"/>
</RollingFile>
```
*Nota:* L'estensione `.gz` o `.zip` nel `filePattern` attiva automaticamente la compressione trasparente in background dei file archiviati!

---

## 4. Matrice di Conversione PatternLayout

| Carattere Log4j 1.x | Equivalente Log4j 2.x | Descrizione |
| :--- | :--- | :--- |
| `%p` | `%-5level` | Livello di log formattato a 5 caratteri allineato a sinistra (`INFO `, `ERROR`). |
| `%m%n` | `%msg%n` (o `%m%n`) | Messaggio di log + terminatore di riga del sistema operativo. |
| `%c` / `%c{1}` | `%logger` / `%logger{1}` | Nome del logger / categoria (o abbreviazione dell'ultimo segmento). |
| `%d{...}` | `%d{...}` | Timestamp formattato (es. `%d{yyyy-MM-dd HH:mm:ss.SSS}`). |
| `%t` | `%t` (o `%thread`) | Nome del thread corrente. |
| `%X{userId}` | `%X{userId}` | Valore della chiave nel contesto `ThreadContext` (ex MDC). |
| `%x` | `%x` (o `%ndc`) | Stack del `ThreadContext` (ex NDC). |
| `%C:%L` | `%class:%line` | Classe e numero di riga (**Attenzione:** impatta le performance, usare con cautela in produzione). |

---

## 5. Esempio Completo di Conversione: Da `log4j.properties` a `log4j2.xml`

### File Originale `log4j.properties` (Legacy)
```properties
log4j.rootLogger=INFO, stdout, file

log4j.appender.stdout=org.apache.log4j.ConsoleAppender
log4j.appender.stdout.Target=System.out
log4j.appender.stdout.layout=org.apache.log4j.PatternLayout
log4j.appender.stdout.layout.ConversionPattern=%d{ISO8601} [%t] %-5p %c{1} - %m%n

log4j.appender.file=org.apache.log4j.DailyRollingFileAppender
log4j.appender.file.File=${catalina.base}/logs/app.log
log4j.appender.file.DatePattern='.'yyyy-MM-dd
log4j.appender.file.layout=org.apache.log4j.PatternLayout
log4j.appender.file.layout.ConversionPattern=%d{yyyy-MM-dd HH:mm:ss} %-5p [%t] %c - %m%n

log4j.logger.com.azienda.progetto=DEBUG
log4j.logger.org.springframework=WARN
```

### File Convertito `log4j2.xml` (Nativo)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="WARN" monitorInterval="30">
    <Properties>
        <Property name="LOG_PATH">${sys:catalina.base:-.}/logs</Property>
    </Properties>

    <Appenders>
        <!-- Console Appender -->
        <Console name="StdoutAppender" target="SYSTEM_OUT">
            <PatternLayout pattern="%d{yyyy-MM-dd'T'HH:mm:ss.SSS} [%t] %-5level %logger{1} - %msg%n"/>
        </Console>

        <!-- Daily Rolling File Appender con fallback su LOG_PATH -->
        <RollingFile name="FileAppender"
                     fileName="${LOG_PATH}/app.log"
                     filePattern="${LOG_PATH}/app-%d{yyyy-MM-dd}.log">
            <PatternLayout pattern="%d{yyyy-MM-dd HH:mm:ss} %-5level [%t] %logger - %msg%n"/>
            <Policies>
                <TimeBasedTriggeringPolicy interval="1" modulate="true"/>
            </Policies>
            <DefaultRolloverStrategy fileIndex="min" max="30"/>
        </RollingFile>
    </Appenders>

    <Loggers>
        <!-- Logger di Package Specifici -->
        <Logger name="com.azienda.progetto" level="DEBUG"/>
        <Logger name="org.springframework" level="WARN"/>

        <!-- Root Logger -->
        <Root level="INFO">
            <AppenderRef ref="StdoutAppender"/>
            <AppenderRef ref="FileAppender"/>
        </Root>
    </Loggers>
</Configuration>
```

---

## 6. Tool Automatico di Conversione Apache

Il modulo bridge `log4j-1.2-api` include un tool CLI nativo in grado di convertire in blocco i file `log4j.properties` semplici:

```bash
java -cp log4j-core-2.24.1.jar:log4j-api-2.24.1.jar:log4j-1.2-api-2.24.1.jar \
     org.apache.log4j.config.Log4j1ConfigurationConverter \
     --in src/main/resources/log4j.properties \
     --out src/main/resources/log4j2.xml
```

*Nota:* Il tool automatico genera una prima bozza funzionale; è sempre necessario effettuare una revisione manuale per verificare i lookup (`${sys:...}`) e le policy di rollover.
