# Log4j 1.x to Log4j 2.x Native Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a comprehensive, production-grade migration playbook, support tooling/scripts/hooks, and a reusable Gemini CLI Skill for migrating Java applications from Log4j 1.x / reload4j to native Log4j 2.x.

**Architecture:** A modular two-tier architecture: (1) In-workspace documentation playbook (`docs/`) providing exhaustive human-readable migration guides, scripts, and pre-commit hooks, and (2) Global Gemini CLI Skill (`~/.gemini/skills/log4j1-to-log4j2-migration/`) with an Agent Harness orchestrating sub-agents, 6 execution steps with mandatory human-in-the-loop review gates, iterative feedback loops, and automated Maven build verifications (`mvn clean install` and `mvn clean package`).

**Tech Stack:** Java (8+ / 11 / 17 / 21), Maven / Gradle, Apache Log4j 2.x (`log4j-api`, `log4j-core`, `log4j-bom`), SLF4J 2.x facade integration, OpenRewrite (`rewrite-maven-plugin`), Shell / PowerShell scripts, Git hooks, Markdown / YAML for Gemini CLI skills.

**Spec:** `docs/superpowers/specs/2026-09-25-log4j1-to-log4j2-migration-design.md`

## Global Constraints

- Refactoring approach is strictly **Native API Migration** (elimination of legacy `org.apache.log4j` packages and jars).
- Target API is **Log4j 2 Native API** (`org.apache.logging.log4j.LogManager`, `Logger`) with explicit guidelines for projects using the SLF4J facade (`log4j-slf4j2-impl`).
- Projects may be single-module or multi-module Maven (`<modules>`) / Gradle multi-project; BOM declaration must be centralized in `<dependencyManagement>` and submodules must separate `log4j-api` (library/core modules) from `log4j-core` / `log4j2.xml` (packaging/runtime modules).
- Every migration step executed by the agent must enforce the **Human-in-the-loop Gate**: pause, summarize changes, verify build with `mvn clean install`, accept developer feedback iteratively, rebuild after each fix, and advance only upon explicit approval.
- Final deployable packaging must be verified via `mvn clean package`.
- Gemini CLI Skill must adhere strictly to `~/.gemini/skills/` specification with valid frontmatter (`name`, `description`).

## Review Focus

1. **Multi-module dependency leakage:** Submodules accidentally bringing transitive Log4j 1.x jars despite root BOM. (Handled via explicit `<exclusions>` in Task 2 and audit script in Task 8).
2. **Missing `sys:` prefix in lookups:** Log4j 1 `${prop}` failing silently in Log4j 2 without `${sys:prop}`. (Explicitly pinned in Task 4 config migration and Task 10 skill reference).
3. **Rollover index inversion:** Log4j 1 rolled files with `1` being the newest, whereas Log4j 2 default makes `1` the oldest. (Explicitly pinned with `<DefaultRolloverStrategy fileIndex="min"/>` in Task 4).
4. **Custom Appenders extending `AppenderSkeleton` breaking build:** OpenRewrite fails on custom appenders. (Handled with `@Plugin` builder rewrite guide in Task 5 and AST analyzer subagent prompt in Task 9).
5. **Token exhaustion during large codebase audits:** Reading every file in a 50-module project fills the main agent's context. (Mitigated via Task 8 fast shell scanner and Task 9 Sub-Agent delegation strategy).

---

### Task 1: Scaffolding Repository Structure and Root Documentation

**Files:**
- Create: `README.md`
- Create: `docs/MIGRATION_PLAYBOOK.md`

**Interfaces:**
- Consumes: Design spec requirements.
- Produces: Navigation entry point and high-level executive playbook for developers and agents.

- [ ] **Step 1: Create `README.md`**
Write the main overview, index of documentation, skill installation instructions, and quick-start guide.

- [ ] **Step 2: Create `docs/MIGRATION_PLAYBOOK.md`**
Write the comprehensive end-to-end migration playbook outlining the 6 phases, prerequisites, decision trees, and quality gates.

- [ ] **Step 3: Verify document structure and markdown rendering**
Inspect files for broken relative links and completeness.

- [ ] **Step 4: Commit changes**
```bash
git add README.md docs/MIGRATION_PLAYBOOK.md
git commit -m "docs: add README and main migration playbook"
```

---

### Task 2: Build & Dependency Management Reference

**Files:**
- Create: `docs/references/01-dependencies-and-build.md`

**Interfaces:**
- Consumes: Spec Section 3.1 (Maven / Gradle multi-module topology, BOM, exclusions, SLF4J).
- Produces: Definitive guide for build engineers on POM/Gradle refactoring.

- [ ] **Step 1: Write `docs/references/01-dependencies-and-build.md`**
Include:
  - Multi-module Maven architecture: Parent POM `<dependencyManagement>` with `log4j-bom`, submodule dependency scoping (`log4j-api` compile vs `log4j-core` runtime/packaging).
  - Gradle multi-project equivalent using `enforcedPlatform` / `platform`.
  - Full exclusion blocks for `log4j:log4j`, `ch.qos.reload4j:reload4j`, `org.slf4j:slf4j-log4j12`, `org.slf4j:log4j-over-slf4j`.
  - SLF4J 2.x bridge binding (`log4j-slf4j2-impl`) vs SLF4J 1.7.x (`log4j-slf4j-impl`).
  - Verification commands: `mvn dependency:tree -Dincludes=log4j:*,ch.qos.reload4j:*` and `mvn clean install`.

- [ ] **Step 2: Verify content completeness**
Verify that all XML snippets and Gradle blocks are syntactically valid and contain concrete versions/properties.

- [ ] **Step 3: Commit changes**
```bash
git add docs/references/01-dependencies-and-build.md
git commit -m "docs: add reference guide for dependencies and build configuration"
```

---

### Task 3: API & Java Code Refactoring Reference

**Files:**
- Create: `docs/references/02-api-and-code-mappings.md`

**Interfaces:**
- Consumes: Spec Section 3.2.
- Produces: Detailed Java coding rules for refactoring classes, methods, levels, ThreadContext, and parameterized logging.

- [ ] **Step 1: Write `docs/references/02-api-and-code-mappings.md`**
Include:
  - Exact import mappings (`org.apache.log4j.*` -> `org.apache.logging.log4j.*`).
  - Factory methods: `Logger.getLogger(...)` and `Category.getInstance(...)` -> `LogManager.getLogger(...)`.
  - Deprecated types: `Category`, `Priority`, `Level`.
  - Runtime level manipulation: Replacing `logger.setLevel(...)` with `Configurator.setLevel(...)`.
  - Diagnostic Context: `MDC` and `NDC` -> `ThreadContext` (map vs stack).
  - Parameterized logging transformations (`{}` placeholder syntax, removing redundant `isDebugEnabled()` guards).
  - Lifecycle: safe removal of `LogManager.shutdown()`.

- [ ] **Step 2: Verify code examples**
Check that Java syntax snippets are accurate and follow modern Java standards.

- [ ] **Step 3: Commit changes**
```bash
git add docs/references/02-api-and-code-mappings.md
git commit -m "docs: add reference guide for API and Java code refactoring"
```

---

### Task 4: Configuration Migration Reference (`log4j.properties` / `log4j.xml` -> `log4j2.xml`)

**Files:**
- Create: `docs/references/03-configuration-migration.md`

**Interfaces:**
- Consumes: Spec Section 3.3.
- Produces: Conversion rules, XML schemas, appender matrices, and lookups conversion guide.

- [ ] **Step 1: Write `docs/references/03-configuration-migration.md`**
Include:
  - Canonical `log4j2.xml` structure with `<Configuration status="WARN">`.
  - System property and environment variable lookup migration (`${foo}` -> `${sys:foo}` / `${env:foo}`).
  - Mapping table for Appenders (Console, File, RollingFile, DailyRollingFile, Async, JDBC, SMTP).
  - RollingFile policies: combining `<TimeBasedTriggeringPolicy>` and `<SizeBasedTriggeringPolicy>`.
  - Rollover strategies: `<DefaultRolloverStrategy fileIndex="min"/>` to maintain Log4j 1 index semantics.
  - PatternLayout conversion characters table (`%p` -> `%-5level`, `%m%n` -> `%msg%n`, `%X` -> `%X{key}`, `%x` -> `%x`).
  - Apache CLI configuration converter tool instructions.

- [ ] **Step 2: Verify XML templates**
Validate XML snippets against Log4j 2 schema guidelines.

- [ ] **Step 3: Commit changes**
```bash
git add docs/references/03-configuration-migration.md
git commit -m "docs: add reference guide for configuration file migration"
```

---

### Task 5: Custom Components Migration Reference

**Files:**
- Create: `docs/references/04-custom-components.md`

**Interfaces:**
- Consumes: Spec Section 3.4.
- Produces: Architecture guide for rewriting custom Appenders, Layouts, and Filters using Log4j 2 `@Plugin` system.

- [ ] **Step 1: Write `docs/references/04-custom-components.md`**
Include:
  - Analysis of legacy `AppenderSkeleton` / `Layout` / `Filter`.
  - Assessment of built-in modern alternatives in Log4j 2 before rewriting.
  - Step-by-step rewrite guide using `@Plugin`, `AbstractAppender`, and `@PluginBuilderFactory`.
  - Code comparison: side-by-side legacy Java 1.x `CustomAppender` vs Log4j 2 `@Plugin` implementation with Builder.
  - Packaging and annotation processing requirement: registering plugins via `log4j-core` annotation processor.

- [ ] **Step 2: Verify Java code examples**
Verify annotation signatures and builder patterns.

- [ ] **Step 3: Commit changes**
```bash
git add docs/references/04-custom-components.md
git commit -m "docs: add reference guide for rewriting custom appenders and layouts"
```

---

### Task 6: OpenRewrite Automated Recipes Guide

**Files:**
- Create: `docs/references/05-openrewrite-recipes.md`

**Interfaces:**
- Consumes: Spec Section 3.5.
- Produces: Practical recipe execution guide using `rewrite-maven-plugin`.

- [ ] **Step 1: Write `docs/references/05-openrewrite-recipes.md`**
Include:
  - OpenRewrite coordinates (`org.openrewrite.recipe:rewrite-logging-frameworks`).
  - Active recipe configuration: `org.openrewrite.java.logging.log4j.Log4j1ToLog4j2` and `ParameterizeLog4j2LoggingStatements`.
  - Command-line execution without modifying POM: `mvn org.openrewrite.maven:rewrite-maven-plugin:run -Drewrite.recipeArtifactCoordinates=...`.
  - Direct POM integration for multi-module projects.
  - Limitations: what OpenRewrite does NOT handle (configurations, custom appenders, programmatic configs).

- [ ] **Step 2: Verify command syntax and plugin configurations**
Check plugin groupId, artifactId, and version validity.

- [ ] **Step 3: Commit changes**
```bash
git add docs/references/05-openrewrite-recipes.md
git commit -m "docs: add reference guide for OpenRewrite automated recipes"
```

---

### Task 7: Pitfalls, Edge Cases and Troubleshooting Reference

**Files:**
- Create: `docs/references/06-pitfalls-and-edge-cases.md`

**Interfaces:**
- Consumes: Spec Section 3 and Section 4.
- Produces: Troubleshooting catalog for common build, runtime, and packaging errors.

- [ ] **Step 1: Write `docs/references/06-pitfalls-and-edge-cases.md`**
Include:
  - ClassNotFoundException / NoClassDefFoundError on `org.apache.log4j.Logger` at runtime.
  - Multiple SLF4J bindings warning / conflict.
  - Programmatic configuration replacement (`PropertyConfigurator.configure()` -> `Configurator.initialize()`).
  - Silent logging failures caused by malformed `log4j2.xml` (using `<Configuration status="TRACE">` for debugging).
  - Third-party libraries pulling legacy Log4j: isolation and bridge strategies when dependencies cannot be refactored immediately.
  - Packaging validation: ensuring `log4j2.xml` is located in `src/main/resources` and packaged in root of JAR/WAR/WEB-INF/classes.

- [ ] **Step 2: Verify troubleshooting solutions**
Ensure every error scenario has a concrete, verified resolution command or pattern.

- [ ] **Step 3: Commit changes**
```bash
git add docs/references/06-pitfalls-and-edge-cases.md
git commit -m "docs: add reference guide for pitfalls, edge cases and troubleshooting"
```

---

### Task 8: Migration Support Scripts & Git Pre-commit Hook

**Files:**
- Create: `scripts/scan-legacy-log4j.sh`
- Create: `scripts/scan-legacy-log4j.ps1`
- Create: `scripts/convert-log4j1-config.sh`
- Create: `hooks/pre-commit`

**Interfaces:**
- Consumes: Spec Section 5.3 (Script e Hook Custom).
- Produces: Automation tooling for fast audit, config conversion, and regression prevention.

- [ ] **Step 1: Write `scripts/scan-legacy-log4j.sh` and `.ps1`**
Create scripts that quickly scan the project directory for:
  - All `pom.xml` / `build.gradle` declaring log4j.
  - All `log4j.properties` / `log4j.xml` configuration files.
  - All `.java` files importing `org.apache.log4j.*` (summarized by package/class).
  - All custom classes extending `AppenderSkeleton`, `Layout`, or `Filter`.

- [ ] **Step 2: Write `scripts/convert-log4j1-config.sh`**
Create helper script to run Apache's `Log4j1ConfigurationConverter`.

- [ ] **Step 3: Write `hooks/pre-commit`**
Create Git hook script that inspects staged files and rejects commits containing `import org.apache.log4j.` unless explicitly bypassed with `--no-verify`.

- [ ] **Step 4: Test scripts locally on sample patterns**
Run the PowerShell and Bash scripts in the repository to verify execution without syntax errors.

- [ ] **Step 5: Commit changes**
```bash
git add scripts/ hooks/
git commit -m "feat: add migration scan scripts, config converter wrapper, and pre-commit hook"
```

---

### Task 9: Gemini CLI Global Skill Definition (`SKILL.md`)

**Files:**
- Create: `D:/Users/YYI5347/.gemini/skills/log4j1-to-log4j2-migration/SKILL.md`

**Interfaces:**
- Consumes: Spec Section 4 and Section 5.
- Produces: The primary operational agent skill in the user's personal skills directory.

- [ ] **Step 1: Write `SKILL.md` frontmatter and trigger description**
Ensure exact matching triggers: "migrazione log4j", "migrate log4j", "log4j 1 to log4j 2", "log4j2 refactoring", "audit log4j".

- [ ] **Step 2: Write the 6-Step Workflow instructions**
Detail:
  - Step 1: Audit & Project Topology Analysis (multi-module Maven `<modules>`, POM hierarchy mapping, library vs packaging modules).
  - Step 2: Build Configuration (Parent POM BOM, submodule dependencies, global exclusions).
  - Step 3: Config File Migration (`log4j.properties`/`log4j.xml` -> `log4j2.xml`).
  - Step 4: Java Refactoring (imports, LogManager, ThreadContext, parameterized logging).
  - Step 5: Custom Component Rewrite (`@Plugin` appender conversion).
  - Step 6: Build & Packaging Verification (`mvn clean install` and `mvn clean package`).

- [ ] **Step 3: Formalize Human-in-the-loop Gate & Iterative Feedback Loop**
Embed mandatory instructions for the agent:
  - Pause after each step.
  - Run build verification (`mvn clean install`).
  - Present summary to developer.
  - Iterate on any feedback/error, rebuild after fixes.
  - Only proceed upon explicit developer approval.

- [ ] **Step 4: Embed Sub-Agent Orchestration & Context Compression guidelines**
Specify when and how to dispatch `@codebase_investigator` for multi-module discovery and `@generalist` for batch file refactoring and build diagnosis.

- [ ] **Step 5: Verify YAML frontmatter and formatting**

---

### Task 10: Gemini CLI Skill Reference Files

**Files:**
- Create: `D:/Users/YYI5347/.gemini/skills/log4j1-to-log4j2-migration/references/api-mappings.md`
- Create: `D:/Users/YYI5347/.gemini/skills/log4j1-to-log4j2-migration/references/config-converter.md`
- Create: `D:/Users/YYI5347/.gemini/skills/log4j1-to-log4j2-migration/references/custom-plugins.md`
- Create: `D:/Users/YYI5347/.gemini/skills/log4j1-to-log4j2-migration/references/pitfalls.md`

**Interfaces:**
- Consumes: Workspace reference files, condensed for token efficiency.
- Produces: Targeted lookup files that the skill reads on-demand during specific steps.

- [ ] **Step 1: Create `references/api-mappings.md`** (Quick mapping tables and regex patterns for batch refactoring).
- [ ] **Step 2: Create `references/config-converter.md`** (Templates for `log4j2.xml`, appenders, and rollover strategies).
- [ ] **Step 3: Create `references/custom-plugins.md`** (Skeleton and boilerplate for `@Plugin` appenders).
- [ ] **Step 4: Create `references/pitfalls.md`** (Critical pitfalls checklist: lookups, exclusions, multi-module scoping).

---

### Task 11: End-to-End Verification & Validation

**Files:**
- Modify/Verify: Workspace and skill integrity.

**Interfaces:**
- Consumes: All deliverables from Tasks 1-10.
- Produces: Complete validation report.

- [ ] **Step 1: Test discovery of the skill**
Verify directory structure in `D:/Users/YYI5347/.gemini/skills/log4j1-to-log4j2-migration/` and confirm files exist and are readable.

- [ ] **Step 2: Verify workspace documentation completeness**
Check that all 6 reference guides in `docs/references/` are linked in `README.md` and `docs/MIGRATION_PLAYBOOK.md`.

- [ ] **Step 3: Run scan script dry run**
Execute `scripts/scan-legacy-log4j.ps1` to ensure script runs cleanly on empty or populated directories.

- [ ] **Step 4: Commit all workspace additions**
```bash
git add .
git commit -m "feat: complete Log4j 1 to Log4j 2 migration playbook, scripts, and skill setup"
```
