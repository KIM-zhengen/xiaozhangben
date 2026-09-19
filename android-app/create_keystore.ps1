# 生成正式签名 keystore（只需运行一次，请记牢密码并保管好生成的两个文件）
$ErrorActionPreference = 'Stop'

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$keyFile = Join-Path $dir 'jizhang-release.jks'
if (Test-Path -LiteralPath $keyFile) {
  Write-Error "已存在 $keyFile 。如需重新生成，请先手动删除该文件和 keystore.properties。"
}

Write-Host '请输入 keystore 密码（至少 6 位，两次一致；以后每次更新版本都要用，请记牢）：'
$pass1 = Read-Host -AsSecureString '密码'
$pass2 = Read-Host -AsSecureString '再次输入密码'
$plain1 = [System.Net.NetworkCredential]::new('', $pass1).Password
$plain2 = [System.Net.NetworkCredential]::new('', $pass2).Password
if ($plain1 -ne $plain2) {
  Write-Error '两次输入的密码不一致，请重新运行。'
}
if ($plain1.Length -lt 6) {
  Write-Error '密码至少需要 6 位，请重新运行。'
}

$keytool = 'C:\Users\NAVIDIA\.jdks\ms-17.0.20.1\bin\keytool.exe'
if (-not (Test-Path -LiteralPath $keytool)) {
  Write-Error '未找到 keytool（预期在 C:\Users\NAVIDIA\.jdks\ms-17.0.20.1\bin）。'
}

& $keytool -genkeypair -v `
  -keystore $keyFile `
  -alias jizhang `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass $plain1 -keypass $plain1 `
  -dname "CN=xiaojizhang, OU=Personal, O=jizhang, L=Unknown, ST=Unknown, C=CN"

$content = "storeFile=../jizhang-release.jks`r`n" +
           "storePassword=$plain1`r`n" +
           "keyAlias=jizhang`r`n" +
           "keyPassword=$plain1`r`n"
[System.IO.File]::WriteAllText(
  (Join-Path $dir 'keystore.properties'),
  $content,
  (New-Object System.Text.UTF8Encoding($false))
)

Write-Host ''
Write-Host '签名文件已生成：'
Write-Host "  $keyFile"
Write-Host "  $(Join-Path $dir 'keystore.properties')"
Write-Host '请把这两个文件备份到安全位置（更新版本必需）。'
