// MQTT 连接测试脚本（请勿提交真实账号密码到公开仓库）
//
// 用法（PowerShell）：
//   $env:MQTT_HOST='broker.emqx.io'
//   $env:MQTT_PORT='1883'
//   $env:MQTT_USERNAME=''
//   $env:MQTT_PASSWORD=''
//   node test-mqtt.cjs

const mqtt = require('mqtt');

console.log('========================================');
console.log('MQTT 连接测试');
console.log('========================================\n');

const HOST = process.env.MQTT_HOST || 'broker.emqx.io';
const PORT = Number(process.env.MQTT_PORT || 1883);
const USERNAME = process.env.MQTT_USERNAME || '';
const PASSWORD = process.env.MQTT_PASSWORD || '';

const configs = [
  {
    name: '测试1: 用户名密码 + MQTT 3.1.1',
    options: {
      host: HOST,
      port: PORT,
      protocol: 'mqtt',
      username: USERNAME,
      password: PASSWORD,
      clientId: `test_client_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 0,
      protocolId: 'MQTT',
      protocolVersion: 4,
    },
  },
  {
    name: '测试2: 无用户名密码 + MQTT 3.1.1',
    options: {
      host: HOST,
      port: PORT,
      protocol: 'mqtt',
      clientId: `test_client_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 0,
      protocolId: 'MQTT',
      protocolVersion: 4,
    },
  },
  {
    name: '测试3: 用户名密码 + MQTT 3.1',
    options: {
      host: HOST,
      port: PORT,
      protocol: 'mqtt',
      username: USERNAME,
      password: PASSWORD,
      clientId: `test_client_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 0,
      protocolId: 'MQIsdp',
      protocolVersion: 3,
    },
  },
];

function testConnection(config) {
  return new Promise((resolve) => {
    console.log(`\n${config.name}`);
    console.log(
      '配置:',
      JSON.stringify(
        {
          host: config.options.host,
          port: config.options.port,
          username: config.options.username || '(无)',
          clientId: config.options.clientId,
          protocolId: config.options.protocolId,
          protocolVersion: config.options.protocolVersion,
        },
        null,
        2,
      ),
    );
    console.log('\n正在连接...');

    const client = mqtt.connect(config.options);
    const timeout = setTimeout(() => {
      console.log('❌ 连接超时');
      client.end(true);
      resolve();
    }, 12000);

    client.on('connect', (connack) => {
      clearTimeout(timeout);
      console.log('✅ 连接成功');
      console.log('CONNACK:', JSON.stringify(connack, null, 2));
      client.end();
      resolve();
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      console.log('❌ 错误:', err.message);
      console.log(
        '错误详情:',
        JSON.stringify(
          {
            code: err.code,
            errno: err.errno,
            syscall: err.syscall,
          },
          null,
          2,
        ),
      );
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
    // eslint-disable-next-line no-await-in-loop
    await testConnection(config);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('\n========================================');
  console.log('所有测试完成');
  console.log('========================================');
}

runTests().catch(console.error);

