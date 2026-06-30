import { AppError, normalizeEmployeeNo, text } from "./http.js";

function parseRows(source) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const delimiter = source.includes("\t") && !source.includes(",") ? "\t" : ",";

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function headerMap(headers) {
  const aliases = {
    employee_no: ["employee_no", "employee no", "employee", "員工編號", "工號", "員編"],
    name: ["name", "姓名", "名字"],
    unit: ["unit", "department", "dept", "單位", "部門"],
    country: ["country", "destination", "國家", "旅遊國家", "目的地"],
  };
  const normalized = headers.map((header) =>
    String(header || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
  );

  return Object.fromEntries(
    Object.entries(aliases).map(([key, names]) => [
      key,
      normalized.findIndex((header) => names.includes(header)),
    ])
  );
}

export function parseWinnersCsv(csvText) {
  const rows = parseRows(String(csvText || ""));
  if (rows.length < 2) {
    throw new AppError(400, "EMPTY_CSV", "請貼上含有標題列與資料列的得獎名單。");
  }

  const indexes = headerMap(rows[0]);
  const missing = Object.entries(indexes)
    .filter(([, index]) => index < 0)
    .map(([key]) => key);

  if (missing.length) {
    throw new AppError(
      400,
      "CSV_HEADER_MISSING",
      "欄位需要包含員工編號、姓名、單位、國家。",
      { missing }
    );
  }

  const winners = [];
  const errors = [];
  const seen = new Set();

  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    const employeeNo = normalizeEmployeeNo(row[indexes.employee_no]);
    const name = text(row[indexes.name], 80);
    const unit = text(row[indexes.unit], 120);
    const country = text(row[indexes.country], 80);

    if (!employeeNo || !name || !unit || !country) {
      errors.push({ row: rowNumber, message: "員工編號、姓名、單位、國家不可空白。" });
      return;
    }

    if (seen.has(employeeNo)) {
      errors.push({ row: rowNumber, message: `員工編號 ${employeeNo} 重複，已略過。` });
      return;
    }

    seen.add(employeeNo);
    winners.push({ employeeNo, name, unit, country });
  });

  return { winners, errors };
}
