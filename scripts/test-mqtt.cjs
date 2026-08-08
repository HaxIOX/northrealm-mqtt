// MQTT connection smoke test.
//
// PowerShell example:
//   $env:MQTT_HOST='broker.emqx.io'
//   $env:MQTT_PORT='1883'
//   $env:MQTT_USERNAME=''
//   $env:MQTT_PASSWORD=''
//   node test-mqtt.cjs

const mqtt = require('mqtt');

console.log('========================================');
console.log('MQTT connection smoke test');
console.log('========================================\n');

const HOST = process.env.MQTT_HOST || 'broker.emqx.io';
const PORT = Number(process.env.MQTT_PORT || 1883);
const USERNAME = process.env.MQTT_USERNAME || '';
const PASSWORD = process.env.MQTT_PASSWORD || '';

const configs = [
  {
    name: 'Test 1: username/password + MQTT 3.1.1',
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
    name: 'Test 2: anonymous + MQTT 3.1.1',
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
    name: 'Test 3: username/password + MQTT 3.1',
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
      'Config:',
      JSON.stringify(
        {
          host: config.options.host,
          port: config.options.port,
          username: config.options.username || '(none)',
          clientId: config.options.clientId,
          protocolId: config.options.protocolId,
          protocolVersion: config.options.protocolVersion,
        },
        null,
        2,
      ),
    );
    console.log('\nConnecting...');

    const client = mqtt.connect(config.options);
    const timeout = setTimeout(() => {
      console.log('Timeout');
      client.end(true);
      resolve();
    }, 12000);

    client.on('connect', (connack) => {
      clearTimeout(timeout);
      console.log('Connected');
      console.log('CONNACK:', JSON.stringify(connack, null, 2));
      client.end();
      resolve();
    });

    client.on('error', (error) => {
      clearTimeout(timeout);
      console.log('Error:', error.message);
      console.log(
        'Details:',
        JSON.stringify(
          {
            code: error.code,
            errno: error.errno,
            syscall: error.syscall,
          },
          null,
          2,
        ),
      );
      client.end(true);
      resolve();
    });

    client.on('close', () => {
      console.log('Connection closed');
    });

    client.on('offline', () => {
      console.log('Client offline');
    });

    client.on('end', () => {
      console.log('Connection ended');
    });
  });
}

async function runTests() {
  for (const config of configs) {
    await testConnection(config);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('\n========================================');
  console.log('All tests finished');
  console.log('========================================');
}

runTests().catch(console.error);
