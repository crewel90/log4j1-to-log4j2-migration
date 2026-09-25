# 02. Mapping API & Refactoring Codice Java

Questa guida fornisce la matrice dettagliata di conversione del codice sorgente Java da Log4j 1.x all'API nativa di Log4j 2.x (`org.apache.logging.log4j`), con le best practice di scrittura del codice e di ottimizzazione delle performance.

---

## 1. Matrice di Conversione Classi e Package

| Classe Log4j 1.x / reload4j | Equivalente Log4j 2 Nativo | Descrizione & Note |
| :--- | :--- | :--- |
| `org.apache.log4j.Logger` | `org.apache.logging.log4j.Logger` | Interfaccia primaria per la registrazione dei messaggi di log. |
| `org.apache.log4j.LogManager` | `org.apache.logging.log4j.LogManager` | Factory per istanziare e recuperare le istanze di `Logger`. |
| `org.apache.log4j.Category` | `org.apache.logging.log4j.Logger` | `Category` era già deprecata in Log4j 1. Va sostituita con `Logger`. |
| `org.apache.log4j.Priority` | `org.apache.logging.log4j.Level` | `Priority` era la superclasse di `Level`. In Log4j 2 esiste solo `Level`. |
| `org.apache.log4j.Level` | `org.apache.logging.log4j.Level` | Rappresenta i livelli di severità (`TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`). |
| `org.apache.log4j.MDC` | `org.apache.logging.log4j.ThreadContext` | Mapped Diagnostic Context (chiave-valore thread-local). |
| `org.apache.log4j.NDC` | `org.apache.logging.log4j.ThreadContext` | Nested Diagnostic Context (stack thread-local). |

---

## 2. Inizializzazione del Logger

### Chiamata Standard
```java
// VECCHIO (Log4j 1)
import org.apache.log4j.Logger;
public class UserService {
    private static final Logger log = Logger.getLogger(UserService.class);
    // oppure: Logger.getLogger("nomeLogger");
}

// NUOVO (Log4j 2 Nativo)
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.LogManager;
public class UserService {
    private static final Logger LOGGER = LogManager.getLogger(UserService.class);
    // oppure: LogManager.getLogger("nomeLogger");
}
```

### Root Logger
```java
// VECCHIO
Logger root = Logger.getRootLogger();

// NUOVO
Logger root = LogManager.getRootLogger();
```

### Sostituzione di Category
```java
// VECCHIO
Category cat = Category.getInstance(UserService.class);

// NUOVO
Logger logger = LogManager.getLogger(UserService.class);
```

---

## 3. Gestione dei Livelli di Log e Modifiche a Runtime

### Mappatura dei Livelli
I livelli standard in Log4j 2 sono ordinati per severità decrescente:
`OFF` > `FATAL` > `ERROR` > `WARN` > `INFO` > `DEBUG` > `TRACE` > `ALL`.

### Lettura del Livello Effettivo
```java
// VECCHIO
Level level = logger.getEffectiveLevel();

// NUOVO
Level level = logger.getLevel();
```

### Modifica Programmatica del Livello a Runtime
In Log4j 2, l'interfaccia `Logger` dell'API pubblica è disaccoppiata dall'implementazione e **non espone** il metodo `setLevel()`.
Per cambiare dinamicamente il livello a runtime (es. in un endpoint REST o un MBean JMX):

```java
// VECCHIO (Log4j 1)
logger.setLevel(Level.DEBUG);

// NUOVO (Log4j 2 Core Configurator)
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.core.config.Configurator;

// Imposta il livello su uno specifico logger
Configurator.setLevel("com.azienda.progetto.UserService", Level.DEBUG);

// Oppure su tutta l'applicazione (Root Logger)
Configurator.setRootLevel(Level.INFO);
```

---

## 4. Diagnostic Context: Da MDC e NDC a `ThreadContext`

In Log4j 2 le strutture mappa (`MDC`) e stack (`NDC`) sono unificate in `org.apache.logging.log4j.ThreadContext`.

### Mappatura MDC (Map)
```java
// VECCHIO (Log4j 1)
import org.apache.log4j.MDC;
MDC.put("sessionId", sessionId);
String sId = (String) MDC.get("sessionId");
MDC.remove("sessionId");
MDC.clear();

// NUOVO (Log4j 2 Nativo)
import org.apache.logging.log4j.ThreadContext;
ThreadContext.put("sessionId", sessionId);
String sId = ThreadContext.get("sessionId");
ThreadContext.remove("sessionId");
ThreadContext.clearMap(); // oppure clearAll()
```

### Mappatura NDC (Stack)
```java
// VECCHIO (Log4j 1)
import org.apache.log4j.NDC;
NDC.push("transazione-1234");
String top = NDC.pop();
NDC.remove();

// NUOVO (Log4j 2 Nativo)
import org.apache.logging.log4j.ThreadContext;
ThreadContext.push("transazione-1234");
String top = ThreadContext.pop();
ThreadContext.clearStack(); // oppure clearAll()
```

### Try-With-Resources (Closeable ThreadContext)
Log4j 2 introduce un pattern moderno ed elegante che evita il rischio di memory leak o contaminazione tra thread del pool:

```java
import org.apache.logging.log4j.CloseableThreadContext;

try (CloseableThreadContext.Instance ctc = CloseableThreadContext.put("userId", user.getId())
                                                                .put("ip", clientIp)) {
    // Tutte le istruzioni di log qui includeranno userId e ip
    LOGGER.info("Operazione completata con successo.");
} // Rimozione automatica delle chiavi all'uscita dal blocco!
```

---

## 5. Logging Parametrizzato & Performance

Uno dei principali colli di bottiglia di Log4j 1 era la concatenazione esplicita delle stringhe prima dell'invocazione del metodo.

### Eliminazione delle Concatenazioni
```java
// VECCHIO (Log4j 1: crea oggetti StringBuilder e stringhe temporanee nella JVM)
if (logger.isDebugEnabled()) {
    logger.debug("Elaborazione ordine ID=" + order.getId() + " cliente=" + order.getCustomerName());
}

// NUOVO (Log4j 2: parametrizzato con '{}')
LOGGER.debug("Elaborazione ordine ID={} cliente={}", order.getId(), order.getCustomerName());
```

### Regole per i Guard Block (`if (logger.isDebugEnabled())`)
* **Quando RIMUOVERE il guard block:** Se i parametri sono variabili già calcolate o getter semplici (es. `order.getId()`), il blocco `if` è **totalmente ridondante** e va rimosso.
* **Quando MANTENERE il guard block:** Se la costruzione dell'argomento richiede calcoli gravosi, chiamate a database o serializzazioni JSON (es. `jsonMapper.writeValueAsString(data)`).
* **Alternativa Moderna (Java 8+ Supplier):** Log4j 2 supporta le lambda expression:
  ```java
  LOGGER.debug("Dump completo: {}", () -> jsonMapper.writeValueAsString(heavyObject));
  ```
  La lambda viene valutata **esclusivamente** se il livello DEBUG è abilitato!

---

## 6. Gestione delle Eccezioni

In Log4j 2 l'oggetto `Throwable` deve sempre essere passato come **ultimo argomento**:

```java
try {
    processPayment(payment);
} catch (PaymentException ex) {
    // Corretto: messaggio parametrizzato + eccezione come ultimo parametro
    LOGGER.error("Fallimento nel pagamento per l'ordine {}", payment.getOrderId(), ex);
}
```
*Nota:* Log4j 2 riconosce automaticamente l'ultimo parametro se è istanza di `Throwable` ed estrae l'intero stacktrace.

---

## 7. Eliminazione di `LogManager.shutdown()`

In Log4j 1, nelle servlet o nei job batch, era comune trovare:
```java
LogManager.shutdown(); // VECCHIO
```
In Log4j 2:
* Il motore `log4j-core` registra automaticamente un Shutdown Hook nella JVM.
* All'arresto della JVM o del container servlet (`Log4jServletContainerInitializer`), i buffer vengono svuotati (flush) e le risorse rilasciate ordinatamente.
* Le chiamate a `LogManager.shutdown()` vanno **semplicemente rimosse**.
