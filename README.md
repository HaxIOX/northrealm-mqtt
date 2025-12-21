# MQTT Pro

一款现代化的 MQTT WebSocket 调试工具，支持云同步、主题切换、消息模板等高级功能。

## 功能特性

### 核心功能
- **MQTT 连接管理** - 支持 `ws://` 和 `wss://` WebSocket 协议
- **订阅管理** - 支持多主题订阅，自动重订阅功能
- **消息发布** - 支持 QoS 0/1/2，Retain 标志
- **实时日志** - 消息收发实时显示，支持 TEXT/HEX 视图切换
- **连接诊断** - 智能诊断连接错误，提供解决建议

### 高级功能
- **快捷指令** - 保存常用发布指令，一键发送
- **消息模板变量** - 支持动态变量：`{{timestamp}}`、`{{datetime}}`、`{{random}}`、`{{count}}`、`{{uuid}}`
- **定时发送** - 自定义间隔自动发送消息
- **配置管理** - 保存/加载多个连接配置

### 云同步
- **多设备同步** - 基于 Firebase 的实时云同步
- **Space ID** - 使用相同 Space ID 的设备自动同步配置和快捷指令
- **本地优先** - 无 Firebase 配置时自动降级为本地模式

### 界面特性
- **双主题** - 支持深色/浅色主题切换
- **响应式设计** - 现代化 UI，流畅动画
- **快捷键支持**
  - `Ctrl/Cmd + Enter` - 发送消息
  - `Ctrl/Cmd + K` - 连接/断开
  - `Ctrl/Cmd + D` - 断开连接
  - `Ctrl/Cmd + L` - 清空日志

## 技术栈

- **前端框架**: React 18
- **构建工具**: Vite
- **样式方案**: Tailwind CSS
- **图标库**: Lucide React
- **MQTT 客户端**: mqtt.js v5.3.5
- **云服务**: Firebase (Auth + Firestore)

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 使用指南

### 连接 MQTT 服务器

1. 在左侧「连接配置」面板中输入服务器信息
2. 选择协议（ws/wss），端口会自动适配
3. 填写 Path（通常为 `/mqtt`）
4. 可选填写用户名和密码
5. 点击「连接」按钮

### 预设公共服务器

| 服务器 | Host | WS 端口 | WSS 端口 | Path |
|--------|------|---------|----------|------|
| EMQX | broker.emqx.io | 8083 | 8084 | /mqtt |
| HiveMQ | broker.hivemq.com | 8000 | 8884 | /mqtt |
| Mosquitto | test.mosquitto.org | 8080 | 8081 | (空) |

### 订阅主题

1. 在「订阅监控」区域输入主题
2. 支持通配符：`#`（多级）、`+`（单级）
3. 点击「订阅」或按 Enter

### 发布消息

1. 在底部发布区域输入 Topic
2. 选择 QoS 等级和 Retain 选项
3. 在文本框中输入消息内容
4. 点击「发送」或按 `Ctrl+Enter`

### 使用消息模板

在消息中使用变量，发送时会自动替换：

```json
{
  "timestamp": {{timestamp}},
  "id": "{{uuid}}",
  "seq": {{count}}
}
```

### 保存快捷指令

1. 配置好要发送的 Topic 和 Payload
2. 点击「存为指令」
3. 输入指令名称（如：开灯、关灯）
4. 在左侧「快捷指令」区域一键发送

### 云同步设置

1. 点击左下角「开启云同步」
2. 输入或生成一个 Space ID
3. 在其他设备使用相同 Space ID 即可同步

## 项目结构

```
MQTT_Pro/
├── src/
│   ├── App.jsx        # 主应用组件
│   ├── main.jsx       # 入口文件
│   └── index.css      # 全局样式
├── public/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## 环境变量

如需启用云同步功能，需要配置 Firebase：

```javascript
// 在运行环境中定义
__firebase_config = JSON.stringify({
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ...其他配置
});
__app_id = "your-app-id";
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
