const { NestFactory } = require('@nestjs/core');
const { DevtoolsMcpModule } = require('../packages/plugin/dist/index');

class TestModule {}
Reflect.defineMetadata('imports', [DevtoolsMcpModule.register()], TestModule);

async function test() {
  const app = await NestFactory.create(TestModule, { bufferLogs: true });
  console.log('loggerApplied before init:', DevtoolsMcpModule.loggerApplied);
  await app.init();
  console.log('loggerApplied after init:', DevtoolsMcpModule.loggerApplied);
  await app.close();
}

test().catch(console.error);
