# 重新生成 keystore.properties（适用于 jizhang-release.jks 已存在、但配置被删掉的情况）
# 用法：powershell -ExecutionPolicy Bypass -File D:\jizhang\android-app\restore_keystore_properties.ps1
$ErrorActionPreference = 'Stop'

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$keyFile = Join-Path $dir 'jizhang-release.jks'
$propFile = Join-Path $dir 'keystore.properties'

if (-not (Test-Path -LiteralPath $keyFile)) {
  Write-Error "未找到 $keyFile。如果是首次签名，请先运行 create_keystore.ps1。"
}

$keytool = 'C:\Users\NAVIDIA\.jdks\ms-17.0.20.1\bin\keytool.exe'
if (-not (Test-Path -LiteralPath $keytool)) {
  Write-Error '未找到 keytool（预期在 C:\Users\NAVIDIA\.jdks\ms-17.0.20.1\bin）。'
}

Write-Host '请输入当初创建 keystore 时设置的密码（输入不会显示）：'
$plain = [System.Net.NetworkCredential]::new('', (Read-Host -AsSecureString '密码')).Password

& $keytool -list -keystore $keyFile -alias jizhang -storepass $plain | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error '密码不正确（或别名不是 jizhang），请重新运行本脚本。'
}

$content = "storeFile=../jizhang-release.jks`r`n" +
           "storePassword=$plain`r`n" +
           "keyAlias=jizhang`r`n" +
           "keyPassword=$plain`r`n"
[System.IO.File]::WriteAllText($propFile, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ''
Write-Host "已写入签名配置：$propFile"
Write-Host '接下来打正式包：'
Write-Host '  powershell -ExecutionPolicy Bypass -File D:\jizhang\android-app\build_apk.ps1 -Task assembleRelease'
