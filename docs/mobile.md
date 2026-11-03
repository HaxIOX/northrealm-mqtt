# 手机端（Android）使用说明

本项目在手机端采用 **Capacitor + Android 原生 MQTT 插件（Paho MQTT v3）** 的方式实现，目标是：
- 必须支持 `mqtt://`（TCP）与 `mqtts://`（TLS）
- MQTT 协议版本先保证 **3.1.1（v4）**
- 认证方式先支持 **用户名/密码**

> 说明：纯浏览器环境无法直连 `mqtt://`/`mqtts://`（1883/8883），浏览器请使用 `ws://`/`wss://`（WebSocket）端口。

---

## 功能概览（手机端 UI）

底部菜单 3 个入口：
- **消息**：订阅消息列表（顶部可筛选 Topic/Payload；支持订阅 Topic；Topic chips 快速筛选日志）
- **指令**：手动发布 / 快捷指令
  - 手动：Topic + QoS/Retain + Payload，一键发送；可保存为快捷指令
  - 快捷：支持搜索、置顶、最近使用、按“前缀/名称”自动分组与折叠
- **配置**：连接参数、连接/断开、主题切换、同步入口等

---

## APK 安装（Debug）

当前默认提供 Debug APK（可直接安装验证）：
- 输出路径：`android/app/build/outputs/apk/debug/app-debug.apk`

安装方式（示例）：
1. 将 APK 拷贝到手机
2. 在手机上允许“安装未知来源应用”
3. 点击 APK 安装

> Release APK 需要签名（keystore），如需上架/分发再做。

---

## 快速开始（推荐）

建议先用公共 Broker 验证链路是否正常：
- Host：`broker.emqx.io`
- 协议：`mqtt`
- Port：`1883`
- 用户名/密码：留空

步骤：
1. 打开 **配置** → 填主机/端口/协议 → 点 **连接**
2. 打开 **消息** → 订阅 `test/topic`
3. 打开 **指令** → 发送 `test/topic` / `{"msg":"hello"}`，观察消息页是否收到

---

## 连接配置说明

### 协议与端口
- `mqtt://` 通常是 `1883`
- `mqtts://` 通常是 `8883`
- `ws://`/`wss://` 需要 Broker 开启 WebSocket 端口（常见 `8083/8084`）与 Path（常见 `/mqtt`）

### ClientID（重要）
部分 Broker 会拒绝重复/非法 ClientID（表现为“连接失败/被拒绝/identifier rejected”）。
- 你可以在 **配置** 页点 **随机**，生成一个新的 ClientID 再试
- 若 Broker 有 ACL（权限控制），也可能按 ClientID 限制访问

---

## 常见问题与排查

### 1）提示 “无权连接 / Not authorized”
一般是 Broker 侧的鉴权或 ACL 拒绝：
- 用户名/密码错误（或密码为空但 Broker 不允许匿名）
- 账号没有权限/ACL 拒绝该 ClientID
- 服务器要求认证但未提供凭据

建议：
- 先用公共 Broker（上面的快速开始）验证“App 链路没问题”
- 再确认你的 Broker 账号权限、ACL、是否允许匿名、是否允许该 ClientID

### 2）`mqtts://` 连接失败（TLS/证书）
可能是证书不受信任（自签名）或 TLS 配置不匹配：
- 临时验证可改用 `mqtt://`
- 若必须 `mqtts://`，需要 Broker 配置正确证书链（客户端信任）

### 3）浏览器端连不上 `mqtt://`
这是正常限制：浏览器不支持 TCP 直连 MQTT。
- 浏览器请使用 `ws://`/`wss://` 连接 WebSocket 端口
- 手机 App / 桌面 App 才能使用 `mqtt://`/`mqtts://`

---

## 开发与打包（Android）

日常同步与构建：
```bash
npm run android:sync
```

构建 Debug APK（Windows PowerShell 示例，使用仓库 `tools/` 里的 JDK/SDK）：
```powershell
Set-Location C:\Users\VIBTEK\Desktop\northrealm-mqtt

$env:JAVA_HOME = "$PWD\tools\jdk-21.0.10+7"
$env:ANDROID_SDK_ROOT = "$PWD\tools\android-sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_SDK_ROOT\platform-tools;$env:ANDROID_SDK_ROOT\cmdline-tools\latest\bin;$env:Path"

npm run android:sync
Set-Location .\android
.\gradlew.bat :app:assembleDebug --no-daemon --console=plain
```

输出 APK：
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 当前限制（按需迭代 / YAGNI）

- 暂不支持 mTLS（客户端证书）
- 二进制 payload 当前按 UTF-8 字符串透传（不做无损二进制）
- 后台常驻长连接（Android/iOS 需额外设计与权限策略）

