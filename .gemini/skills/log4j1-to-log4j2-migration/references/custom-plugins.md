# Skill Reference: Custom Plugin Rewrite

Questo documento contiene lo scheletro e le annotazioni per convertire `AppenderSkeleton` in componenti nativi `@Plugin` di Log4j 2 nello **Step 5: Custom Component Rewrite**.

## Scheletro Appender Plugin con Builder Pattern

```java
package com.azienda.logging;

import org.apache.logging.log4j.core.*;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Property;
import org.apache.logging.log4j.core.config.plugins.*;
import org.apache.logging.log4j.core.config.plugins.validation.constraints.Required;
import java.io.Serializable;

@Plugin(
    name = "CustomTarget", 
    category = Core.CATEGORY_NAME, 
    elementType = Appender.ELEMENT_TYPE, 
    printObject = true
)
public final class CustomTargetAppender extends AbstractAppender {

    private final String customParam;

    private CustomTargetAppender(String name, Filter filter, Layout<? extends Serializable> layout,
                                 boolean ignoreExceptions, Property[] properties, String customParam) {
        super(name, filter, layout, ignoreExceptions, properties);
        this.customParam = customParam;
    }

    @PluginBuilderFactory
    public static Builder newBuilder() {
        return new Builder();
    }

    public static class Builder extends AbstractAppender.Builder<Builder>
            implements org.apache.logging.log4j.core.util.Builder<CustomTargetAppender> {

        @PluginBuilderAttribute
        @Required(message = "customParam è obbligatorio per CustomTargetAppender")
        private String customParam;

        public Builder setCustomParam(String customParam) {
            this.customParam = customParam;
            return this;
        }

        @Override
        public CustomTargetAppender build() {
            return new CustomTargetAppender(getName(), getFilter(), getLayout(),
                    isIgnoreExceptions(), getPropertyArray(), customParam);
        }
    }

    @Override
    public void append(LogEvent event) {
        byte[] payload = getLayout().toByteArray(event);
        // Elaborazione log (scrittura socket, db, client esterno)
    }
}
```

## Configurazione in `log4j2.xml`
Aggiungere il package al tag `<Configuration packages="com.azienda.logging">`:
```xml
<Configuration packages="com.azienda.logging">
    <Appenders>
        <CustomTarget name="MyCustomAppender" customParam="valore">
            <PatternLayout pattern="%msg%n"/>
        </CustomTarget>
    </Appenders>
</Configuration>
```
