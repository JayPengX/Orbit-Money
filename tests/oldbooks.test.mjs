// Another app's books as history (lib/oldbooks.mjs): 天天記帳's CSV.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tiantianEntries, noteInvoice, isTiantian } from '../public/lib/oldbooks.mjs';

const HEAD = '﻿日期,類別,大類別,金額,幣別,成員,帳戶,標籤,備註,收支區分,上次更新,UUID';
const CSV = [
  HEAD,
  '20261020,晚餐,飲食,150,TWD,自己,簽帳金融卡,,"滷排骨飯  1*125=125\n蜜香檸檬茶  1*25=25\n\n2026年10月20日 19:21:56\n八方雲集餐飲股份有限公司御廚竹北莊敬店\n#電子發票號碼: FJ96480068\n",支,2026-10-25 14:45:45,73E6427C-CA13-4C1B-9582-6AF3C7F9F210',
  '20261021,利息,,2,TWD,自己,帳戶,,,收,2026-10-25 14:46:48,6E806E70-F741-4622-B8DF-7763D35C7C76',
  '20241216,加量,爸媽,1000,TWD,爸爸,現金,,,收,2025-02-23 22:46:58,37501DE9-CBF4-4BDE-B48A-DB68359643DC',
  '20250101,我,,600,TWD,自己,現金,,阿姨給的紅包,收,2025-01-01 10:00:00,AAAAAAAA-0000-0000-0000-000000000001',
  '20250102,日常,,-5,TWD,自己,現金,,,支,2025-01-02 10:00:00,AAAAAAAA-0000-0000-0000-000000000002',
  '20250103,早餐,飲食,80,USD,自己,現金,,,支,2025-01-03 10:00:00,AAAAAAAA-0000-0000-0000-000000000003'
].join('\r\n');

test('a note 天天記帳 wrote from the 載具: items, day, seller, number', () => {
  const inv = noteInvoice('拿鐵  2*55=110\n\n2026年1月5日 08:00:00\n統一超商股份有限公司\n#電子發票號碼: AB12345678\n');
  assert.deepEqual(inv, { no: 'AB12345678', day: '2026-01-05', seller: '統一超商股份有限公司', items: [{ name: '拿鐵', qty: 2, price: 55 }] });
  assert.equal(noteInvoice('just a note'), null);
});

test('rows become history: no account, the old one named, categories mapped, oldest first', () => {
  assert.ok(isTiantian(CSV));
  const es = tiantianEntries(CSV, { shorten: s => s.replace(/(股份)?有限公司.*$/, '') });
  assert.deepEqual(es.map(e => [e.d, e.k, e.amt, e.cat, e.note, e.a, e.old]), [
    ['2024-12-16', 'in', 1000, 'allowance', '加量（爸爸）', '', '現金'],
    ['2025-01-01', 'in', 600, 'redenv', '阿姨給的紅包', '', '現金'],
    ['2025-01-02', 'in', 5, 'refund', '日常', '', '現金'],
    ['2026-10-20', 'out', 150, 'food', '八方雲集餐飲', '', '簽帳金融卡'],
    ['2026-10-21', 'in', 2, 'invest', '利息', '', '帳戶']
  ]);
  const dinner = es.find(e => e.inv);
  assert.equal(dinner.id, 'tt-73e6427c-ca13-4c1b-9582-6af3c7f9f210');
  assert.deepEqual(dinner.inv, { no: 'FJ96480068', day: '2026-10-20', sid: '', seller: '八方雲集餐飲', total: 150, items: [{ name: '滷排骨飯', qty: 1, price: 125 }, { name: '蜜香檸檬茶', qty: 1, price: 25 }], from: 'old' });
  assert.deepEqual(tiantianEntries('日期,金額\n20260101,5'), []);
});
