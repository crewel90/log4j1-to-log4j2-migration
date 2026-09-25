<#
.SYNOPSIS
    Esegue la scansione e l'audit rapido di un progetto Java per rilevare dipendenze, file di configurazione e classi che usano Log4j 1.x / reload4j.
.PARAMETER TargetDir
    La directory radice del progetto da analizzare (default: cartella corrente).
#>
param (
    [string]$TargetDir = "."
)

Write-Host '==========================================================' -ForegroundColor Cyan
Write-Host '[AUDIT] Log4j 1.x to Log4j 2.x Discovery Scanner' -ForegroundColor Cyan
Write-Host "Directory target: $TargetDir" -ForegroundColor Cyan
Write-Host '==========================================================' -ForegroundColor Cyan

# 1. Rilevamento struttura POM e Gradle
Write-Host "`n[1/4] Analisi file di build (Maven / Gradle)..." -ForegroundColor Yellow
$pomFiles = Get-ChildItem -Path $TargetDir -Recurse -Filter "pom.xml" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "(\\.[a-zA-Z0-9]+|target|node_modules)" }
$gradleFiles = Get-ChildItem -Path $TargetDir -Recurse -Include "build.gradle", "settings.gradle" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "(\\.[a-zA-Z0-9]+|target|node_modules)" }

$pomCount = if ($pomFiles) { $pomFiles.Count } else { 0 }
$gradleCount = if ($gradleFiles) { $gradleFiles.Count } else { 0 }

Write-Host "  -> Trovati $pomCount pom.xml e $gradleCount file Gradle."
$legacyBuildFiles = @()

if ($pomFiles) {
    foreach ($pom in $pomFiles) {
        $content = Get-Content $pom.FullName -Raw -ErrorAction SilentlyContinue
        if ($content -match "<artifactId>\s*(log4j|reload4j|slf4j-log4j12|log4j-over-slf4j)\s*</artifactId>") {
            $legacyBuildFiles += $pom.FullName
            Write-Host "  [!] Dipendenza legacy trovata in: $($pom.FullName)" -ForegroundColor Red
        }
    }
}

# 2. Rilevamento file di configurazione
Write-Host "`n[2/4] Ricerca file di configurazione legacy (log4j.properties, log4j.xml)..." -ForegroundColor Yellow
$configFiles = Get-ChildItem -Path $TargetDir -Recurse -Include "log4j.properties", "log4j.xml", "log4j-test.properties", "log4j-test.xml" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "(\\.[a-zA-Z0-9]+|target|node_modules)" }
$configCount = if ($configFiles) { $configFiles.Count } else { 0 }

if ($configCount -eq 0) {
    Write-Host "  Nessun file di configurazione legacy individuato." -ForegroundColor Green
} else {
    foreach ($cfg in $configFiles) {
        Write-Host "  [CONFIG] Trovato file config: $($cfg.FullName)" -ForegroundColor Magenta
    }
}

# 3. Scansione classi Java con import org.apache.log4j
Write-Host "`n[3/4] Scansione sorgenti Java per import org.apache.log4j.*..." -ForegroundColor Yellow
$javaFiles = Get-ChildItem -Path $TargetDir -Recurse -Filter "*.java" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "(\\.[a-zA-Z0-9]+|target|node_modules)" }
$javaCount = if ($javaFiles) { $javaFiles.Count } else { 0 }

$legacyJavaFiles = @()
$customAppenderFiles = @()

if ($javaFiles) {
    foreach ($jf in $javaFiles) {
        $lines = Get-Content $jf.FullName -ErrorAction SilentlyContinue
        $hasLegacyImport = $false
        $isCustomComponent = $false

        foreach ($l in $lines) {
            if ($l -match "^\s*import\s+org\.apache\.log4j\.") {
                $hasLegacyImport = $true
            }
            if ($l -match "extends\s+(AppenderSkeleton|DailyRollingFileAppender|RollingFileAppender)" -or $l -match "implements\s+(Appender|Layout|Filter)") {
                $isCustomComponent = $true
            }
        }

        if ($hasLegacyImport) {
            $legacyJavaFiles += $jf.FullName
        }
        if ($isCustomComponent) {
            $customAppenderFiles += $jf.FullName
            Write-Host "  [CUSTOM] Componente Custom rilevato: $($jf.FullName)" -ForegroundColor Cyan
        }
    }
}

$legacyJavaCount = $legacyJavaFiles.Count
$legacyColor = if ($legacyJavaCount -eq 0) { "Green" } else { "Red" }

Write-Host "  -> Totale classi Java nel progetto: $javaCount"
Write-Host "  -> Classi con import legacy Log4j 1.x: $legacyJavaCount" -ForegroundColor $legacyColor

# 4. Riepilogo Sintetico
Write-Host "`n================== RIEPILOGO AUDIT ==================" -ForegroundColor Cyan
Write-Host "File di Build con dipendenze legacy: $($legacyBuildFiles.Count)"
Write-Host "File di configurazione legacy:       $configCount"
Write-Host "File Java con import legacy:         $legacyJavaCount"
Write-Host "Componenti Custom da riscrivere:     $($customAppenderFiles.Count)"
Write-Host '======================================================' -ForegroundColor Cyan
