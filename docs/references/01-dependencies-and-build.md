# 01. Gestione Dipendenze & Build Maven/Gradle

Questa guida descrive come configurare correttamente i file di build (Maven `pom.xml` o Gradle `build.gradle`) per eliminare completamente Log4j 1.x e adottare Log4j 2.x in modo pulito e nativo, sia in progetti a modulo singolo che in architetture complesse **multi-modulo**.

---

## 1. Architettura Multi-Modulo Maven

Nelle architetture aziendali multi-modulo è comune avere:
1. **Un Parent POM radice** (`packaging: pom` con tag `<modules>`).
2. **Moduli Libreria / Business Logic** (`packaging: jar`): contengono servizi, entità, logica di business e dipendono da altri sottomoduli.
3. **Moduli di Packaging / Deploy** (`packaging: war`, Spring Boot Fat JAR o EAR): assemblano l'applicazione finale e contengono la configurazione di logging di runtime.

### Regola Aurea di Separazione dei Moduli:
* **Parent POM:** Dichiara il BOM di Log4j 2 in `<dependencyManagement>` ed esclude globalmente `log4j:log4j` e `reload4j`.
* **Moduli Business / JAR:** Dipendono **solamente** da `log4j-api` con scope `compile`. Se necessario per i test unitari locali, possono includere `log4j-core` con scope `test`. Non devono includere `log4j-core` a compile o runtime.
* **Moduli Packaging / WAR / JAR Finale:** Includono `log4j-core` con scope `runtime` (o `compile`) e contengono il file di configurazione `log4j2.xml`.

---

## 2. Configurazione Maven (Consigliata)

### 2.1 Parent POM (`pom.xml` radice)
Inserire il `log4j-bom` all'interno della sezione `<dependencyManagement>`:

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.azienda.progetto</groupId>
    <artifactId>parent-project</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>pom</packaging>

    <properties>
        <log4j2.version>2.24.1</log4j2.version>
    </properties>

    <dependencyManagement>
        <dependencies>
            <!-- Log4j 2 BOM: allinea tutte le versioni dei moduli Log4j -->
            <dependency>
                <groupId>org.apache.logging.log4j</groupId>
                <artifactId>log4j-bom</artifactId>
                <version>${log4j2.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <modules>
        <module>modulo-core</module>
        <module>modulo-servizi</module>
        <module>modulo-web</module>
    </modules>
</project>
```

### 2.2 Sottomodulo Business / Libreria (`modulo-core/pom.xml`)
Dichiara solo `log4j-api` (la versione è ereditata dal BOM):

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0" ...>
    <parent>
        <groupId>com.azienda.progetto</groupId>
        <artifactId>parent-project</artifactId>
        <version>1.0.0-SNAPSHOT</version>
    </parent>

    <artifactId>modulo-core</artifactId>
    <packaging>jar</packaging>

    <dependencies>
        <!-- API di Log4j 2 per produrre log -->
        <dependency>
            <groupId>org.apache.logging.log4j</groupId>
            <artifactId>log4j-api</artifactId>
        </dependency>

        <!-- Opzionale: core solo per eseguire i test del modulo -->
        <dependency>
            <groupId>org.apache.logging.log4j</groupId>
            <artifactId>log4j-core</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
```

### 2.3 Sottomodulo Packaging / Web Application (`modulo-web/pom.xml`)
Include il motore di logging a runtime e, se necessario, il bridge per SLF4J:

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0" ...>
    <parent>
        <groupId>com.azienda.progetto</groupId>
        <artifactId>parent-project</artifactId>
        <version>1.0.0-SNAPSHOT</version>
    </parent>

    <artifactId>modulo-web</artifactId>
    <packaging>war</packaging>

    <dependencies>
        <dependency>
            <groupId>com.azienda.progetto</groupId>
            <artifactId>modulo-core</artifactId>
            <version>${project.version}</version>
        </dependency>

        <!-- Log4j 2 Core Implementation -->
        <dependency>
            <groupId>org.apache.logging.log4j</groupId>
            <artifactId>log4j-core</artifactId>
            <scope>runtime</scope>
        </dependency>

        <!-- SE l'applicazione o librerie terze usano SLF4J: binding SLF4J verso Log4j2 -->
        <dependency>
            <groupId>org.apache.logging.log4j</groupId>
            <artifactId>log4j-slf4j2-impl</artifactId>
            <scope>runtime</scope>
        </dependency>
    </dependencies>
</project>
```

---

## 3. Esclusioni Vincolanti delle Dipendenze Transitive

Le vecchie librerie terze (es. Spring 3/4 legacy, Hibernate 3, Apache Commons, Zookeeper) spesso importano transitivamente `log4j:log4j`.
Se un JAR legacy finisce nel runtime, si verificano conflitti di binding o errori `NoSuchMethodError`.

### Esclusione Mirata su una Dipendenza
```xml
<dependency>
    <groupId>com.terze.parti</groupId>
    <artifactId>libreria-legacy</artifactId>
    <version>3.2.1</version>
    <exclusions>
        <exclusion>
            <groupId>log4j</groupId>
            <artifactId>log4j</artifactId>
        </exclusion>
        <exclusion>
            <groupId>ch.qos.reload4j</groupId>
            <artifactId>reload4j</artifactId>
        </exclusion>
        <exclusion>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-log4j12</artifactId>
        </exclusion>
        <exclusion>
            <groupId>org.slf4j</groupId>
            <artifactId>log4j-over-slf4j</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

### Esclusione Globale via Maven Enforcer Plugin
Per garantire che nessuno sviluppatore introduca inavvertitamente `log4j:log4j`, aggiungi al Parent POM:

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-enforcer-plugin</artifactId>
    <version>3.5.0</version>
    <executions>
        <execution>
            <id>banned-legacy-log4j</id>
            <goals>
                <goal>enforce</goal>
            </goals>
            <configuration>
                <rules>
                    <bannedDependencies>
                        <excludes>
                            <exclude>log4j:log4j</exclude>
                            <exclude>ch.qos.reload4j:reload4j</exclude>
                            <exclude>org.slf4j:slf4j-log4j12</exclude>
                            <exclude>org.slf4j:log4j-over-slf4j</exclude>
                        </excludes>
                        <message>ATTENZIONE: Trovata dipendenza legacy Log4j 1.x bandita! Escludila dal POM.</message>
                    </bannedDependencies>
                </rules>
                <fail>true</fail>
            </configuration>
        </execution>
    </executions>
</plugin>
```

---

## 4. Configurazione Alternativa: Gradle Multi-Project

Se il progetto utilizza Gradle:

### Nel Root `build.gradle` (o `settings.gradle`):
```groovy
subprojects {
    apply plugin: 'java'

    dependencies {
        // Importa BOM per allineare le versioni
        implementation platform('org.apache.logging.log4j:log4j-bom:2.24.1')

        // API per tutti i moduli
        implementation 'org.apache.logging.log4j:log4j-api'
    }

    // Esclusione globale di Log4j 1.x da tutte le configurazioni
    configurations.all {
        exclude group: 'log4j', module: 'log4j'
        exclude group: 'ch.qos.reload4j', module: 'reload4j'
        exclude group: 'org.slf4j', module: 'slf4j-log4j12'
        exclude group: 'org.slf4j', module: 'log4j-over-slf4j'
    }
}
```

### Nel modulo Web / App finale (`app/build.gradle`):
```groovy
dependencies {
    implementation project(':modulo-core')
    runtimeOnly 'org.apache.logging.log4j:log4j-core'
    runtimeOnly 'org.apache.logging.log4j:log4j-slf4j2-impl'
}
```

---

## 5. Matrice di Compatibilità SLF4J

Se l'applicazione o le sue dipendenze utilizzano SLF4J come facciata, scegliere il modulo di binding corretto:

| Versione SLF4J nel Progetto | Modulo Log4j 2 da Aggiungere | Modulo Legacy da Rimuovere |
| :--- | :--- | :--- |
| **SLF4J 2.0.x** (consigliata) | `org.apache.logging.log4j:log4j-slf4j2-impl` | `org.slf4j:slf4j-log4j12` o `slf4j-reload4j` |
| **SLF4J 1.7.x** (legacy) | `org.apache.logging.log4j:log4j-slf4j-impl` | `org.slf4j:slf4j-log4j12` |

*Attenzione:* Non includere mai contemporaneamente `log4j-slf4j-impl` e `log4j-slf4j2-impl`.

---

## 6. Comandi di Verifica

Eseguire sempre i seguenti comandi per accertarsi che non vi siano infiltrazioni:

```bash
# 1. Verifica assenza di dipendenze Log4j 1 / reload4j
mvn dependency:tree -Dincludes=log4j:*,ch.qos.reload4j:*,org.slf4j:slf4j-log4j12

# 2. Build completa con installazione nel repository locale
mvn clean install -DskipTests
```
L'albero delle dipendenze deve mostrare esclusivamente artefatti `org.apache.logging.log4j:log4j-*`.
