#!/usr/bin/env bash
#
# Log4j 1.x to Log4j 2.x Audit & Discovery Scanner
# Usage: ./scripts/scan-legacy-log4j.sh [TARGET_DIR]
#

TARGET_DIR="${1:-.}"

echo "=========================================================="
echo "🔍 Log4j 1.x to Log4j 2.x Audit & Discovery Scanner"
echo "Directory target: $TARGET_DIR"
echo "=========================================================="

echo -e "\n[1/4] Analisi file di build (Maven / Gradle)..."
POM_FILES=$(find "$TARGET_DIR" -name "pom.xml" -not -path "*/.*" -not -path "*/target/*")
GRADLE_FILES=$(find "$TARGET_DIR" -name "*.gradle" -not -path "*/.*" -not -path "*/target/*")

LEGACY_BUILDS=0
for pom in $POM_FILES; do
    if grep -E -q "<artifactId>(log4j|reload4j|slf4j-log4j12|log4j-over-slf4j)</artifactId>" "$pom"; then
        echo "  ⚠️ Dipendenza legacy trovata in: $pom"
        ((LEGACY_BUILDS++))
    fi
done

echo -e "\n[2/4] Ricerca file di configurazione legacy (log4j.properties, log4j.xml)..."
CONFIG_FILES=$(find "$TARGET_DIR" -type f \( -name "log4j.properties" -o -name "log4j.xml" -o -name "log4j-test.properties" -o -name "log4j-test.xml" \) -not -path "*/.*" -not -path "*/target/*")
CONFIG_COUNT=0
for cfg in $CONFIG_FILES; do
    echo "  📄 Trovato file config: $cfg"
    ((CONFIG_COUNT++))
done
if [ $CONFIG_COUNT -eq 0 ]; then
    echo "  Nessun file di configurazione legacy individuato."
fi

echo -e "\n[3/4] Scansione sorgenti Java per import org.apache.log4j.*..."
JAVA_FILES=$(find "$TARGET_DIR" -name "*.java" -not -path "*/.*" -not -path "*/target/*")
LEGACY_JAVA=0
CUSTOM_COMPONENTS=0

for jf in $JAVA_FILES; do
    if grep -E -q "^\s*import\s+org\.apache\.log4j\." "$jf"; then
        ((LEGACY_JAVA++))
    fi
    if grep -E -q "extends\s+(AppenderSkeleton|DailyRollingFileAppender|RollingFileAppender)|implements\s+(Appender|Layout|Filter)" "$jf"; then
        echo "  🧩 Componente Custom rilevato: $jf"
        ((CUSTOM_COMPONENTS++))
    fi
done

echo -e "\n================== RIEPILOGO AUDIT =================="
echo "File di Build con dipendenze legacy: $LEGACY_BUILDS"
echo "File di configurazione legacy:       $CONFIG_COUNT"
echo "File Java con import legacy:         $LEGACY_JAVA"
echo "Componenti Custom da riscrivere:     $CUSTOM_COMPONENTS"
echo "======================================================"
