#!/usr/bin/env bash
#
# Helper script per eseguire Log4j1ConfigurationConverter ufficiale di Apache Log4j
# Usage: ./scripts/convert-log4j1-config.sh [INPUT_FILE] [OUTPUT_FILE]
#

INPUT_FILE="${1:-src/main/resources/log4j.properties}"
OUTPUT_FILE="${2:-src/main/resources/log4j2.xml}"

echo "=========================================================="
echo "🔄 Apache Log4j 1 to Log4j 2 Configuration Converter"
echo "Input:  $INPUT_FILE"
echo "Output: $OUTPUT_FILE"
echo "=========================================================="

if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ Errore: File di input '$INPUT_FILE' non trovato!"
    exit 1
fi

LOG4J_VERSION="2.24.1"
CP_JARS=""

# Cerca se i JAR sono presenti nella cache locale di Maven (~/.m2/repository)
M2_REPO="$HOME/.m2/repository/org/apache/logging/log4j"
CORE_JAR="$M2_REPO/log4j-core/$LOG4J_VERSION/log4j-core-$LOG4J_VERSION.jar"
API_JAR="$M2_REPO/log4j-api/$LOG4J_VERSION/log4j-api-$LOG4J_VERSION.jar"
BRIDGE_JAR="$M2_REPO/log4j-1.2-api/$LOG4J_VERSION/log4j-1.2-api-$LOG4J_VERSION.jar"

if [ -f "$CORE_JAR" ] && [ -f "$API_JAR" ] && [ -f "$BRIDGE_JAR" ]; then
    echo "Trovati JAR in ~/.m2/repository. Esecuzione del convertitore..."
    java -cp "$CORE_JAR:$API_JAR:$BRIDGE_JAR" org.apache.log4j.config.Log4j1ConfigurationConverter --in "$INPUT_FILE" --out "$OUTPUT_FILE"
    echo "✅ Conversione completata! File generato in $OUTPUT_FILE"
    echo "⚠️ Ricorda di verificare manualmente i Lookups \${sys:...} e le DefaultRolloverStrategy."
else
    echo "I JAR di Log4j 2 non sono presenti nella cache locale ~/.m2/repository."
    echo "Scarica temporaneamente le dipendenze eseguendo:"
    echo "mvn dependency:get -Dartifact=org.apache.logging.log4j:log4j-core:$LOG4J_VERSION"
    echo "mvn dependency:get -Dartifact=org.apache.logging.log4j:log4j-api:$LOG4J_VERSION"
    echo "mvn dependency:get -Dartifact=org.apache.logging.log4j:log4j-1.2-api:$LOG4J_VERSION"
    echo ""
    echo "Oppure esegui manualmente:"
    echo "java -cp <path-to-jars> org.apache.log4j.config.Log4j1ConfigurationConverter --in $INPUT_FILE --out $OUTPUT_FILE"
fi
