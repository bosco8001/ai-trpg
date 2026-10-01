/** 檢查本機備份格式與校驗；不載入 .env、不接資料庫、不還原或修復資料。 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseRawBackup } from '../../src/shared/raw-data-backup.js';

if (!process.argv[2]) throw new Error('請提供要檢查的備份檔案路徑。');
const text = await readFile(process.argv[2], 'utf8');
const { backup, payload } = parseRawBackup(JSON.parse(text));
if (createHash('sha256').update(backup.payload, 'utf8').digest('hex') !== backup.checksum.value)
  throw new Error('備份校驗失敗，內容可能已改動。沒有修改來源檔案。');
console.log(`格式與 SHA-256 校驗通過。來源：${payload.storage === 'memory' ? '暫存記憶體' : '資料庫'}；擷取時間：${payload.capturedAt}；完整檔案：${Buffer.byteLength(text)} bytes。`);
console.log(`目前資料：${payload.current === null ? '不存在' : '已保留'}；存檔 1／2／3：${payload.slots.map(slot => slot.record === null ? '空槽' : '已保留').join('／')}。`);
console.log('這只確認格式與完整性，不代表資料合法、能載入或能修復。');
