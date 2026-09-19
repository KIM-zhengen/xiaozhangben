param(
  [string]$Task = 'assembleDebug'
)
# 一键打包 APK
#   assembleDebug   -> 调试包
#   assembleRelease -> 正式包（需先生成签名，见 create_keystore.ps1）
$ErrorActionPreference = 'Stop'

# 1. 使用兼容的 JDK 17（Gradle 8.9 不支持 JDK 25）
$env:JAVA_HOME = 'C:\Users\NAVIDIA\.jdks\ms-17.0.20.1'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$env:GRADLE_OPTS = '-Dorg.gradle.native=false'

# 2. 定位本地 Gradle 8.9
$gradleBat = 'D:\gradle-8.9\bin\gradle.bat'
if (-not (Test-Path -LiteralPath $gradleBat)) {
  Write-Error '未找到 D:\gradle-8.9\bin\gradle.bat，请先解压 gradle-8.9 到 D:\gradle-8.9。'
}

# 3. 构建（第一次会联网下载 Android 构建插件，约 10~30 分钟）
Set-Location 'D:\jizhang\android-app'
& $gradleBat $Task --no-daemon

Write-Output '构建完成。'
if ($Task -eq 'assembleRelease') {
  Write-Output 'D:\jizhang\android-app\app\build\outputs\apk\release\app-release.apk'
} else {
  Write-Output 'D:\jizhang\android-app\app\build\outputs\apk\debug\app-debug.apk'
}
