# Skill Reference: API Mappings & Code Refactoring

Questo documento contiene i riferimenti sintetici per l'agente durante lo **Step 4: Java Code Refactoring**.

## Matrice di Sostituzione Import & Classi

| Log4j 1.x / reload4j | Log4j 2.x Nativo | Note |
|---|---|---|
| `org.apache.log4j.Logger` | `org.apache.logging.log4j.Logger` | Interfaccia logger principale |
| `org.apache.log4j.LogManager` | `org.apache.logging.log4j.LogManager` | Factory method class |
| `Logger.getLogger(...)` | `LogManager.getLogger(...)` | Sostituire con LogManager |
| `Logger.getRootLogger()` | `LogManager.getRootLogger()` | Root logger |
| `Category.getInstance(...)` | `LogManager.getLogger(...)` | Category deprecata |
| `org.apache.log4j.Level` | `org.apache.logging.log4j.Level` | Livelli severità |
| `org.apache.log4j.Priority` | `org.apache.logging.log4j.Level` | Sostituire con Level |
| `logger.getEffectiveLevel()` | `logger.getLevel()` | Lettura livello |
| `logger.setLevel(Level.X)` | `Configurator.setLevel(name, Level.X)` | `org.apache.logging.log4j.core.config.Configurator` |
| `org.apache.log4j.MDC` | `org.apache.logging.log4j.ThreadContext` | `ThreadContext.put(k, v)`, `get(k)`, `remove(k)`, `clearMap()` |
| `org.apache.log4j.NDC` | `org.apache.logging.log4j.ThreadContext` | `ThreadContext.push(v)`, `pop()`, `clearStack()` |
| `LogManager.shutdown()` | *(Rimuovere)* | Gestito da JVM shutdown hook di Log4j 2 |

## Trasformazioni Pattern Logging Parametrizzato

### Esempio 1: Concatenazione semplice
```java
// VECCHIO
logger.info("Utente " + user.getId() + " ha effettuato l'accesso da " + ip);
// NUOVO
LOGGER.info("Utente {} ha effettuato l'accesso da {}", user.getId(), ip);
```

### Esempio 2: Eccezione
```java
// VECCHIO
logger.error("Errore nel processo: " + ex.getMessage(), ex);
// NUOVO
LOGGER.error("Errore nel processo: {}", ex.getMessage(), ex);
```
*Regola:* L'eccezione va sempre posta come ultimo argomento del metodo di log.

### Esempio 3: Rimozione Guard Block Inutile
```java
// VECCHIO
if (logger.isDebugEnabled()) {
    logger.debug("Valore calcolato: " + x);
}
// NUOVO
LOGGER.debug("Valore calcolato: {}", x);
```
