// Migration 005: earlier driver requirements and discount answers move into «Условия аренды».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { createStore } = require('../store');
const { createCars } = require('../cars');

test('005: driver requirements and discount are kept inside restrictions', () => {
  const conn = db.open(':memory:');
  const cars = createCars(conn);
  const pid = createStore(conn).getOrCreate(1, 'p').id;
  const both = cars.create(pid, { driverRequirements: 'от 25 лет', longTermDiscount: 'от 7 дней минус 10%', restrictions: 'Без выезда за границу' });
  const one = cars.create(pid, { driverRequirements: 'стаж от 3 лет' });
  const none = cars.create(pid, { restrictions: 'Только по городу' });

  conn.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', '005-rental-terms.sql'), 'utf8'));

  assert.strictEqual(cars.get(both.id).restrictions, 'Требования к водителю: от 25 лет. Скидка: от 7 дней минус 10%. Без выезда за границу');
  assert.strictEqual(cars.get(one.id).restrictions, 'Требования к водителю: стаж от 3 лет.');
  assert.strictEqual(cars.get(none.id).restrictions, 'Только по городу');
  for (const c of [both, one, none].map(x => cars.get(x.id))) {
    assert.strictEqual(c.driverRequirements, null);
    assert.strictEqual(c.longTermDiscount, null);
  }
});
