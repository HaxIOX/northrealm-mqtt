// MQTT 连接测试脚本
const mqtt = require('mqtt');

console.log('========================================');
console.log('MQTT 连接测试');
console.log('========================================\n');

const configs = [
  {
    name: '测试1: 有用户名密码 + MQTT 3.1.1',
    options: {
      host: '123.57.18.53',
      port: 1883,
      protocol: 'mqtt',
      username: '3slfb2rz',
      password: 'wwh3oh1d',
      clientId: 'test_client_' + Math.random().toString(16).substr(2, 8),
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 0, // 禁用自动重连
      protocolId: 'MQTT',
      protocolVersion: 4
    }
  },
  {
    name: '测试2: 无用户名密码 + MQTT 3.1.1',
    options: {
      host: '123.57.18.53',
      port: 1883,
      protocol: 'mqtt',
      clientId: 'test_client_' + Math.random().toString(16).substr(2, 8),
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 0,
      protocolId: 'MQTT',
      protocolVersion: 4
    }
  },
  {
    name: '测试3: 有用户名密码 + MQTT 3.1',
    options: {
      host: '123.57.18.53',
      port: 1883,
      protocol: 'mqtt',
      username: '3slfb2rz',
      password: 'wwh3oh1d',
      clientId: 'test_client_' + Math.random().toString(16).substr(2, 8),
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 0,
      protocolId: 'MQIsdp',
      protocolVersion: 3
    }
  }
];

let currentIndex = 0;

function testConnection(config) {
  return new Promise((resolve) => {
    console.log(`\n${config.name}`);
    console.log('配置:', JSON.stringify({
      host: config.options.host,
      port: config.options.port,
      username: config.options.username || '(无)',
      clientId: config.options.clientId,
      protocolId: config.options.protocolId,
      protocolVersion: config.options.protocolVersion
    }, null, 2));
    console.log('\n正在连接...');

    const client = mqtt.connect(config.options);

    const timeout = setTimeout(() => {
      console.log('❌ 连接超时');
      client.end(true);
      resolve();
    }, 12000);

    client.on('connect', (connack) => {
      clearTimeout(timeout);
      console.log('✅ 连接成功！');
      console.log('CONNACK:', JSON.stringify(connack, null, 2));
      client.end();
      resolve();
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      console.log('❌ 错误:', err.message);
      console.log('错误详情:', JSON.stringify({
        code: err.code,
        errno: err.errno,
        syscall: err.syscall
      }, null, 2));
      client.end(true);
      resolve();
    });

    client.on('close', () => {
      console.log('⚠️  连接已关闭');
    });

    client.on('offline', () => {
      console.log('📴 客户端离线');
    });

    client.on('end', () => {
      console.log('🔌 连接结束');
    });
  });
}

async function runTests() {
  for (const config of configs) {
    await testConnection(config);
    await new Promise(r => setTimeout(r, 2000)); // 等待2秒再测试下一个
  }

  console.log('\n========================================');
  console.log('所有测试完成');
  console.log('========================================');
}

runTests().catch(console.error);
