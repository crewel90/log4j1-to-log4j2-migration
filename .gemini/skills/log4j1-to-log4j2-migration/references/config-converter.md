# Skill Reference: Configuration File Converter (`log4j2.xml`)

Questo documento contiene i template e le regole di conversione per lo **Step 3: Config File Migration**.

## Template Canonico `log4j2.xml`
Salvare in `src/main/resources/log4j2.xml` del modulo di runtime.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="WARN" monitorInterval="30">
    <Properties>
        <!-- Obbligatorio prefisso sys: per le variabili -D -->
        <Property name="LOG_DIR">${sys:catalina.base:-logs}/logs</Property>
        <Property name="LOG_PATTERN">%d{yyyy-MM-dd HH:mm:ss.SSS} [%t] %-5level %logger{36} - %msg%n</Property>
    </Properties>

    <Appenders>
        <!-- Console Appender -->
        <Console name="Console" target="SYSTEM_OUT">
            <PatternLayout pattern="${LOG_PATTERN}"/>
        </Console>

        <!-- RollingFile Appender (Tempo + Dimensione con compressione) -->
        <RollingFile name="AppRollingFile" 
                     fileName="${LOG_DIR}/application.log"
                     filePattern="${LOG_DIR}/application-%d{yyyy-MM-dd}-%i.log.gz">
            <PatternLayout pattern="${LOG_PATTERN}"/>
            <Policies>
                <TimeBasedTriggeringPolicy interval="1" modulate="true"/>
                <SizeBasedTriggeringPolicy size="50MB"/>
            </Policies>
            <!-- Preserva la sequenza di indici di Log4j 1 (1 = file più recente ruotato) -->
            <DefaultRolloverStrategy fileIndex="min" max="30"/>
        </RollingFile>
    </Appenders>

    <Loggers>
        <!-- Loggers applicativi -->
        <Logger name="com.azienda" level="DEBUG"/>
        
        <!-- Loggers librerie terze -->
        <Logger name="org.springframework" level="INFO"/>
        <Logger name="org.hibernate" level="WARN"/>

        <!-- Root Logger -->
        <Root level="INFO">
            <AppenderRef ref="Console"/>
            <AppenderRef ref="AppRollingFile"/>
        </Root>
    </Loggers>
</Configuration>
```

## PatternLayout Conversion Checklist
- `%p` -> `%-5level`
- `%m%n` -> `%msg%n`
- `%d{ISO8601}` -> `%d{yyyy-MM-dd'T'HH:mm:ss.SSS}`
- `%X{id}` -> `%X{id}`
- `${nomeProprieta}` -> `${sys:nomeProprieta}` (o `${env:VAR}`)
