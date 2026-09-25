# 07. Gestione Git, Sicurezza e Protezione Branch

Questa guida definisce il protocollo formale di gestione Git che l'agente AI e lo sviluppatore devono osservare durante una migrazione da Log4j 1 a Log4j 2, garantendo la tracciabilità delle modifiche, la reversibilità sicura e la **protezione assoluta dei branch di produzione (`main` / `master`)**.

---

## 1. Branching Strategy & Pre-Requisito (Step 0)

È tassativamente vietato effettuare modifiche direttamente sui branch principali (`main` o `master`).

### Inizializzazione del Branch di Migrazione
Prima di toccare qualsiasi riga di codice o file `pom.xml`:
```bash
# 1. Verifica che non vi siano modifiche non committate in corso
git status

# 2. Allineamento con il branch remoto
git checkout main
git pull origin main

# 3. Creazione e switch sul branch di migrazione dedicato
git checkout -b migration/log4j2
```
*Convenzioni di naming del branch:* `migration/log4j2`, `feature/log4j2-native-migration`.

---

## 2. Attivazione Hook Pre-Commit

All'avvio della migrazione (Step 1), installare l'hook fornito dall'harness per impedire a chiunque nel team di reintrodurre accidentalmente import legacy di Log4j 1:

```bash
# Su Linux / macOS / Git Bash:
cp .gemini/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Su Windows PowerShell:
Copy-Item -Force '.gemini\hooks\pre-commit' '.git\hooks\pre-commit'
```

---

## 3. Commit Atomici per Step Approvato (Conventional Commits)

Ad ogni step del workflow, dopo che la build (`mvn clean install`) è risultata verde e lo sviluppatore ha convalidato le modifiche, si effettua un commit atomico e circoscritto.

| Step del Workflow | Comando Commit e Messaggio Convenzionale |
| :--- | :--- |
| **Step 2 (Build & POM)** | `git add **/pom.xml` <br>`git commit -m "build(deps): migrate dependencies to Log4j 2 BOM and exclude legacy log4j1"` |
| **Step 3 (Config XML)** | `git add **/log4j2.xml` <br>`git commit -m "chore(logging): convert log4j configuration to canonical log4j2.xml"` |
| **Step 4 (Codice Java)** | `git add **/*.java` <br>`git commit -m "refactor(logging): migrate Java code to native Log4j 2 LogManager and ThreadContext"` |
| **Step 5 (Plugin Custom)** | `git add **/*.java` <br>`git commit -m "feat(logging): migrate custom appenders to Log4j 2 @Plugin architecture"` |

---

## 4. Protocollo di Rollback Deterministico

Se durante uno step emergono errori imprevisti, rotture di compilazione non sanabili o se lo sviluppatore decide di scartare l'iterazione in corso:

```bash
# Ripristina tutti i file tracciati modificati nello step corrente
git restore .

# Rimuove eventuali nuovi file non tracciati generati durante l'iterazione
git clean -fd
```
Grazie ai commit atomici eseguiti ad ogni step, questa operazione riporta il progetto all'ultimo stato verde e validato con precisione matematica.

---

## 5. Regola di Protezione Assoluta di `main` / `master`

### 5.1 Divieto di Merge Diretto o Push Non Approvato
* **Nessun automatismo di merge:** L'agente AI **non esegue mai autonomamente** comandi di `git merge` verso `main` o `master`.
* **Nessun push diretto su branch protetti:** L'agente non esegue mai `git push origin main` o `git push origin master`.

### 5.2 Percorso Standard: Pull Request (Consigliato)
Al termine dello Step 6 (Packaging & Verifica Finale):
1. Si effettua il push del branch di migrazione:
   ```bash
   git push -u origin migration/log4j2
   ```
2. L'agente fornisce un riepilogo formale da incollare nella Pull Request:
   * Matrice dei moduli migrati e dipendenze escluse.
   * Esito delle build `mvn clean install` e `mvn clean package`.
   * Checklist di verifica a runtime.
3. L'approvazione e il merge su `main` avvengono tramite la normale revisione del team (GitHub / GitLab / Bitbucket PR).

### 5.3 Percorso Eccezionale: Merge Locale con Approvazione Esplicita
Se lo sviluppatore richiede espressamente di completare il merge in locale sul proprio PC, l'agente deve seguire questo protocollo vincolante:

1. **Verifica Finale:** Assicurarsi che `mvn clean install` e `mvn clean package` siano passati con successo.
2. **Presentazione del Dettaglio:** Mostrare la lista dei commit che verrebbero integrati:
   ```bash
   git log --oneline main..migration/log4j2
   ```
3. **Richiesta Formale di Approvazione:** L'agente si ferma e chiede allo sviluppatore:
   > *"La migrazione è verificata e la build è verde. Confermi esplicitamente il merge del branch 'migration/log4j2' su 'main'?"*
4. **Esecuzione (Solo dopo l'ok esplicito dell'utente):**
   ```bash
   git checkout main
   git pull origin main
   git merge --no-ff migration/log4j2 -m "chore(logging): merge log4j2 migration branch"
   ```
