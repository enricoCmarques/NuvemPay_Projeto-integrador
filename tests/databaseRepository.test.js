const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseRepository = require('../src/repositories/DatabaseRepository');

test('DatabaseRepository inicia corretamente e expõe estrutura inicial', async () => {
  await DatabaseRepository.init();
  const data = await DatabaseRepository.readData();

  assert.deepEqual(data, { users: [], transactions: [] });
  assert.ok(DatabaseRepository.getDbPath().endsWith('.sqlite') || DatabaseRepository.getDbPath().endsWith('.db'));
});
