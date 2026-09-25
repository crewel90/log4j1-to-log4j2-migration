# 04. Riscrivere Componenti Custom (Appenders, Layouts, Filters)

In molte applicazioni enterprise legacy esistono componenti proprietari scritti estendendo le classi interne di Log4j 1.x (come `AppenderSkeleton`, `Layout`, o `Filter`).
Queste classi **non esistono** in Log4j 2 e **non possono essere convertite automaticamente da tool come OpenRewrite**.

Questa guida illustra la strategia per analizzare, rimpiazzare o riscrivere tali componenti nell'architettura a plugin di Log4j 2.

---

## 1. Fase di Valutazione: Rimpiazzo vs Riscrittura

Prima di iniziare a scrivere codice Java per migrare un appender custom, verificare se Log4j 2 non fornisca già nativamente la funzionalità richiesta:

| Esigenza Custom Legacy | Soluzione Nativa Out-of-the-Box in Log4j 2 |
| :--- | :--- |
| Formattazione log in formato JSON / structured data | `<JsonTemplateLayout>` o `<JsonLayout>` |
| Invio asincrono con buffer e code thread-safe | `<Async>` appender basato sulla libreria ad alte prestazioni LMAX Disruptor |
| Routing dinamico dei log su file diversi in base al tenant / utente | `<Routing>` appender con script o pattern dinamici |
| Invio log verso Kafka, Flume, NoSQL, Socket SSL | `<Kafka>`, `<Socket>`, `<Http>`, `<JMS>` nativi |
| Filtraggio avanzato su espressioni regolari o condizioni logiche | `<RegexFilter>`, `<ScriptFilter>`, `<ThreadContextMapFilter>` |

Se la logica è standardizzabile, **è sempre preferibile eliminare il componente custom** e configurare il componente nativo di Log4j 2 in `log4j2.xml`.

---

## 2. Architettura dei Plugin in Log4j 2

In Log4j 2 tutti i componenti (Appender, Layout, Filter, Lookups) sono **Plugin gestiti dal core**:
1. **Annotazione `@Plugin`:** Dichiara il nome XML del plugin, la categoria (`Core`) e l'elemento (`appender`).
2. **Classe Base `AbstractAppender`:** Fornisce la gestione del ciclo di vita (`start()`, `stop()`), dei filtri e del layout.
3. **Pattern Builder con `@PluginBuilderFactory`:** Sostituisce i vecchi setter con un builder tipizzato e validato con `@PluginBuilderAttribute` e `@PluginElement`.
4. **Metodo `append(LogEvent event)`:** Riceve l'evento di log immutabile da elaborare.

---

## 3. Confronto Codice: Da `AppenderSkeleton` a `@Plugin`

### Implementazione Legacy (Log4j 1.x)
```java
package com.azienda.logging;

import org.apache.log4j.AppenderSkeleton;
import org.apache.log4j.spi.LoggingEvent;

public class CustomAuditAppender extends AppenderSkeleton {

    private String endpointUrl;
    private int timeout = 5000;

    public void setEndpointUrl(String endpointUrl) {
        this.endpointUrl = endpointUrl;
    }

    public void setTimeout(int timeout) {
        this.timeout = timeout;
    }

    @Override
    protected void append(LoggingEvent event) {
        String formattedMessage = (layout != null) ? layout.format(event) : event.getRenderedMessage();
        // Invia il messaggio all'endpoint HTTP/Audit
        AuditClient.send(endpointUrl, formattedMessage, timeout);
    }

    @Override
    public void close() {
        // Rilascio risorse
    }

    @Override
    public boolean requiresLayout() {
        return true;
    }
}
```

### Implementazione Nativa Moderna (Log4j 2.x)
```java
package com.azienda.logging;

import org.apache.logging.log4j.core.Appender;
import org.apache.logging.log4j.core.Core;
import org.apache.logging.log4j.core.Filter;
import org.apache.logging.log4j.core.Layout;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Property;
import org.apache.logging.log4j.core.config.plugins.Plugin;
import org.apache.logging.log4j.core.config.plugins.PluginBuilderAttribute;
import org.apache.logging.log4j.core.config.plugins.PluginBuilderFactory;
import org.apache.logging.log4j.core.config.plugins.PluginElement;
import org.apache.logging.log4j.core.config.plugins.validation.constraints.Required;

import java.io.Serializable;

@Plugin(
    name = "CustomAudit", 
    category = Core.CATEGORY_NAME, 
    elementType = Appender.ELEMENT_TYPE, 
    printObject = true
)
public final class CustomAuditAppender extends AbstractAppender {

    private final String endpointUrl;
    private final int timeout;

    private CustomAuditAppender(String name, Filter filter, Layout<? extends Serializable> layout,
                                boolean ignoreExceptions, Property[] properties,
                                String endpointUrl, int timeout) {
        super(name, filter, layout, ignoreExceptions, properties);
        this.endpointUrl = endpointUrl;
        this.timeout = timeout;
    }

    @PluginBuilderFactory
    public static Builder newBuilder() {
        return new Builder();
    }

    public static class Builder extends AbstractAppender.Builder<Builder>
            implements org.apache.logging.log4j.core.util.Builder<CustomAuditAppender> {

        @PluginBuilderAttribute
        @Required(message = "L'endpointUrl per CustomAuditAppender è obbligatorio")
        private String endpointUrl;

        @PluginBuilderAttribute
        private int timeout = 5000;

        public Builder setEndpointUrl(String endpointUrl) {
            this.endpointUrl = endpointUrl;
            return this;
        }

        public Builder setTimeout(int timeout) {
            this.timeout = timeout;
            return this;
        }

        @Override
        public CustomAuditAppender build() {
            return new CustomAuditAppender(getName(), getFilter(), getLayout(),
                    isIgnoreExceptions(), getPropertyArray(), endpointUrl, timeout);
        }
    }

    @Override
    public void append(LogEvent event) {
        byte[] data = getLayout().toByteArray(event);
        String formattedMessage = new String(data);
        AuditClient.send(endpointUrl, formattedMessage, timeout);
    }
}
```

---

## 4. Configurazione del Plugin in `log4j2.xml`

Una volta ricompilato, il nuovo appender può essere utilizzato direttamente in XML usando il nome specificato nell'annotazione `@Plugin(name = "CustomAudit")`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!-- packages="..." indica a Log4j 2 dove cercare i plugin personalizzati -->
<Configuration status="WARN" packages="com.azienda.logging">
    <Appenders>
        <CustomAudit name="AuditService" endpointUrl="https://audit.azienda.internal/api/v1/logs" timeout="3000">
            <PatternLayout pattern="%d{ISO8601} [%t] %-5level %logger - %msg%n"/>
        </CustomAudit>
    </Appenders>

    <Loggers>
        <Root level="INFO">
            <AppenderRef ref="AuditService"/>
        </Root>
    </Loggers>
</Configuration>
```

---

## 5. Compilazione e Generazione del Plugin Descriptor

Log4j 2 indicizza i plugin a tempo di compilazione tramite un annotation processor per garantire tempi di avvio istantanei.
Verificare che il `pom.xml` del modulo contenente il plugin custom includa `log4j-core` nel compilatore:

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-compiler-plugin</artifactId>
    <version>3.13.0</version>
    <configuration>
        <annotationProcessorPaths>
            <path>
                <groupId>org.apache.logging.log4j</groupId>
                <artifactId>log4j-core</artifactId>
                <version>${log4j2.version}</version>
            </path>
        </annotationProcessorPaths>
    </configuration>
</plugin>
```

Questo genera all'interno del JAR finale il file:
`META-INF/org/apache/logging/log4j/core/config/plugins/Log4j2Plugins.dat`
che consente a Log4j 2 di rilevare immediatamente il plugin all'avvio.
