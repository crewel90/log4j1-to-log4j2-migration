# Skill Reference: Common Pitfalls & Build Checklist

Checklist rapida per l'agente per prevenire errori frequenti durante la migrazione.

## 1. Conflitti di Dipendenze e Binding SLF4J
- **Problema:** Avviso `multiple SLF4J bindings` a console.
- **Verifica:** Lancia `mvn dependency:tree -Dincludes=org.slf4j:*`.
- **Risoluzione:** Escludi `slf4j-log4j12` o `slf4j-reload4j`. Mantieni solo `log4j-slf4j2-impl` (SLF4J 2.x) o `log4j-slf4j-impl` (SLF4J 1.7.x).

## 2. Assenza Totale di Log a Runtime
- **Problema:** L'applicazione parte ma non scrive file di log.
- **Diagnostica rapida:** Imposta `<Configuration status="TRACE">` temporaneamente nella prima riga di `log4j2.xml` e riavvia. Leggi l'errore di sintassi segnalato.
- **Verifica percorso:** Conferma che `log4j2.xml` sia salvato in `src/main/resources/log4j2.xml` e non in directory generiche.

## 3. Lookups Variabili non Risolti
- **Problema:** File di log nominati `${catalina.base}/logs/...`.
- **Risoluzione:** Sostituisci con `${sys:catalina.base}` per le System Property passate con `-D` o `${env:VAR}` per le variabili d'ambiente OS.

## 4. ClassNotFoundException: `org.apache.log4j.Logger`
- **Problema:** Librerie di terze parti non aggiornabili invocano Log4j 1 a runtime.
- **Risoluzione:** Aggiungi la dipendenza bridge `org.apache.logging.log4j:log4j-1.2-api` con scope `runtime`.

## 5. Verifica Finale Packaging
- **Verifica:** Esegui `mvn clean package` e controlla l'archivio con `jar -tf target/*.war`:
  - `WEB-INF/classes/log4j2.xml` DEVE essere presente.
  - `WEB-INF/lib/log4j-api-*.jar` e `log4j-core-*.jar` DEVONO essere presenti.
  - NESSUN `log4j-1.2.*.jar` o `reload4j-*.jar` deve essere presente.
