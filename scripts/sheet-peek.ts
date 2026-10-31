// Первые строки листа: npx tsx scripts/sheet-peek.ts <файл> <лист> [строк]
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
const wb = XLSX.read(readFileSync(process.argv[2]), { type: "buffer" });
const ws = wb.Sheets[process.argv[3]];
const m = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
for (const r of m.slice(0, Number(process.argv[4] ?? 14))) console.log(JSON.stringify(r).slice(0, 260));
