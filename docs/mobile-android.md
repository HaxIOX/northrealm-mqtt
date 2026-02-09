# Android 手机端（MQTT TCP/TLS）方案说明

本项目 Web 端基于 Vite+React，手机端要求必须支持 `mqtt://` 与 `mqtts://`（TCP/TLS），因此不能只靠浏览器/WS，需要原生 Socket 能力。

当前实现采用：
- Capacitor：复用现有前端 UI 与业务逻辑
- Android 原生插件：提供 TCP MQTT 3.1.1 连接能力
- JS 侧 mqtt.js 兼容层：在移动端注入 `window.mqtt.connect()`，尽量不改现有 UI 代码（KISS/DRY）

## 能力范围（当前版本）
- 支持协议：`mqtt://`、`mqtts://`
- MQTT 协议版本：3.1.1
- 认证：用户名/密码
- 订阅/取消订阅/发布/接收消息
- 基础自动重连：使用 Paho `setAutomaticReconnect(true)`（按 UI 的自动重连开关启用/禁用；暂不严格遵循 reconnectPeriod 毫秒数）

不包含（后续按需迭代，YAGNI）：
- mTLS（客户端证书）
- 二进制 payload 的无损传输（当前按 UTF-8 字符串透传）
- 后台常驻长连接（Android/iOS 对后台限制较多，通常需要额外设计）

## 关键文件
- JS 注入层：`src/mqtt/nativeMobileMqtt.js`
- 原生插件：`android/app/src/main/java/com/vibtek/northrealm/NativeMqttPlugin.java`
- 插件注册：`android/app/src/main/java/com/vibtek/northrealm/MainActivity.java`

## 开发工作流
1. 安装依赖
```bash
npm ci
```

2. 首次生成 Android 工程（只需要一次）
```bash
npm run android:add
```

3. 每次修改前端后同步到 Android
```bash
npm run android:sync
```

4. 打开 Android 工程
```bash
npm run android:open
```

## 构建环境要求
- Android 构建需要 Java 11+（推荐 JDK 17）与 Android SDK（通常由 Android Studio 配置）
- 若你系统默认 Java 版本过旧（例如 Java 8），Gradle/AGP 会直接报错

## 打包 APK（Debug）

Windows PowerShell 示例（使用本仓库 `tools/` 里的 JDK/SDK）：
```powershell
Set-Location C:\Users\VIBTEK\Desktop\northrealm-mqtt

$env:JAVA_HOME = "$PWD\tools\jdk-21.0.10+7"
$env:ANDROID_SDK_ROOT = "$PWD\tools\android-sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_SDK_ROOT\platform-tools;$env:ANDROID_SDK_ROOT\cmdline-tools\latest\bin;$env:Path"

npm run android:sync
Set-Location .\android
.\gradlew.bat :app:assembleDebug --no-daemon --console=plain
```

APK 输出位置：
`android/app/build/outputs/apk/debug/app-debug.apk`

说明：
- Release 包需要签名（keystore）；当前先以 Debug APK 为主（满足“可安装/可验证”）。
