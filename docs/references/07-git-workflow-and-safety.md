# 07. Gestione Git, Sicurezza e Protezione Branch

Questa guida definisce il protocollo formale di gestione Git che l'agente AI e lo sviluppatore devono osservare durante una migrazione da Log4j 1 a Log4j 2, garantendo la tracciabilità delle modifiche, la reversibilità sicura e la **protezione assoluta dei branch di produzione (`main` / `master`)**.

---

## 1. Branching Strategy & Pre-Requisito (Step 0)

È tassativamente vietato effettuare modifiche direttamente sui branch protetti o di rilascio (`main`, `master`, `collaudo`, `test`, `prod`).

### 1.1 Riconoscimento dei Branch di Sviluppo
Nelle organizzazioni enterprise e nei flussi di sviluppo software:
* **Branch NON di sviluppo (PROTETTI / RILASCIO):** `main`, `master`, `collaudo`, `test`, `release`, `prod`. Da questi branch **non** si deve sviluppare direttamente la migrazione.
* **Branch di sviluppo standard:** `sviluppo`, `svil`, `svl`, `dev`, `develop`.

L'agente deve verificare il branch corrente e, se rileva che ci si trova su `main`, `master` o `collaudo`, deve avvertire lo sviluppatore e richiedere il checkout del branch di sviluppo effettivo.

---

### 1.2 Scenario A: Progetto NON Versionato (Nessuna cartella `.git`)
Se il progetto non è sotto controllo di versione:
1. L'agente chiede autorizzazione ad inizializzare il repository: `git init`.
2. Effettua un commit di baseline per congelare lo stato iniziale pre-migrazione:
   ```bash
   git add .
   git commit -m "chore: initial baseline commit before log4j2 migration"
   ```
3. Chiede allo sviluppatore il nome desiderato per il branch di migrazione (es. `migration/log4j2` o nome a scelta).
4. Crea e si sposta sul nuovo branch:
   ```bash
   git checkout -b <nome-scelto-dallo-sviluppatore>
   ```

---

### 1.3 Scenario B: Progetto Già Versionato
Se il progetto è già un repository Git:
1. **Verifica Working Tree:** Accertare con `git status` che l'albero di lavoro sia completamente pulito (nessun file modified o untracked non salvato).
2. **Controllo Branch di Sviluppo:** Rilevare il branch corrente. Se non corrisponde a un branch di sviluppo (es. `sviluppo`, `svil`, `svl`, `dev`), chiedere allo sviluppatore il nome del branch di sviluppo e posizionarsi su di esso:
   ```bash
   git checkout sviluppo
   git pull origin sviluppo
   ```
3. **Richiesta Nome Branch:** Chiedere allo sviluppatore:
   *"Quale nome desideri assegnare al nuovo branch dedicato alla migrazione Log4j 2?"* (suggerendo `migration/log4j2`).
4. **Creazione Branch di Migrazione:**
   ```bash
   git checkout -b <nome-scelto-dallo-sviluppatore>
   ```

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
