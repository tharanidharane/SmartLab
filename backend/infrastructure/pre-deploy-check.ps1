$ErrorActionPreference = "Stop"

$configFile = "samconfig.toml"

if (-not (Test-Path $configFile)) {
    Write-Host "Error: $configFile not found!" -ForegroundColor Red
    exit 1
}

$kmsKeyIdMatch = Select-String -Path $configFile -Pattern 'KmsKeyId=\\"(.*?)\\"'
$kmsKeyId = if ($kmsKeyIdMatch) { $kmsKeyIdMatch.Matches.Groups[1].Value } else { $null }

$userPoolIdMatch = Select-String -Path $configFile -Pattern 'CognitoUserPoolId=\\"(.*?)\\"'
$userPoolId = if ($userPoolIdMatch) { $userPoolIdMatch.Matches.Groups[1].Value } else { $null }

$clientIdMatch = Select-String -Path $configFile -Pattern 'CognitoClientId=\\"(.*?)\\"'
$clientId = if ($clientIdMatch) { $clientIdMatch.Matches.Groups[1].Value } else { $null }

if (-not $kmsKeyId) { Write-Host "Could not parse KmsKeyId from $configFile" -ForegroundColor Yellow }
if (-not $userPoolId) { Write-Host "Could not parse CognitoUserPoolId from $configFile" -ForegroundColor Yellow }
if (-not $clientId) { Write-Host "Could not parse CognitoClientId from $configFile" -ForegroundColor Yellow }

Write-Host "Verifying AWS pre-requisites..." -ForegroundColor Cyan

# 1. Check KMS Key
if ($kmsKeyId) {
    Write-Host "Checking KMS Key: $kmsKeyId"
    try {
        $null = aws kms describe-key --key-id $kmsKeyId 2>&1
        Write-Host "  ✅ KMS Key exists" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ KMS Key not found or access denied: $kmsKeyId" -ForegroundColor Red
        $failure = $true
    }
}

# 2. Check User Pool
if ($userPoolId) {
    Write-Host "Checking Cognito User Pool: $userPoolId"
    try {
        $null = aws cognito-idp describe-user-pool --user-pool-id $userPoolId 2>&1
        Write-Host "  ✅ User Pool exists" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Cognito User Pool not found or access denied: $userPoolId" -ForegroundColor Red
        $failure = $true
    }
}

# 3. Check App Client
if ($userPoolId -and $clientId) {
    Write-Host "Checking Cognito App Client: $clientId in User Pool: $userPoolId"
    try {
        $null = aws cognito-idp describe-user-pool-client --user-pool-id $userPoolId --client-id $clientId 2>&1
        Write-Host "  ✅ App Client exists" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Cognito App Client not found or access denied: $clientId" -ForegroundColor Red
        $failure = $true
    }
}

if ($failure) {
    Write-Host ""
    Write-Host "⚠️ DEPLOYMENT BLOCKED" -ForegroundColor Red
    Write-Host "One or more resources required by early validation do not exist in your account." -ForegroundColor Red
    Write-Host "Please fix the missing resources or update the parameters in your samconfig.toml" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host ""
    Write-Host "✅ All pre-requisite resources exist." -ForegroundColor Green
    Write-Host "Proceeding with sam deploy..." -ForegroundColor Green
    
    # You can call SAM deploy here, or manually call it after
    # sam deploy
}
