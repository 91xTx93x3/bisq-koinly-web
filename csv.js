export function parseCsv(text, name = "CSV") {
  if (!text.trim()) throw new Error(`${name}: el archivo está vacío.`);
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error(`${name}: hay comillas sin cerrar.`);
  if (cell || row.length) {
    row.push(cell);
    if (row.some(value => value.trim() !== "")) rows.push(row);
  }
  if (!rows.length) throw new Error(`${name}: no contiene filas.`);
  const headers = rows.shift().map(value => value.trim());
  if (headers.some(header => !header)) throw new Error(`${name}: contiene una columna sin nombre.`);
  if (new Set(headers).size !== headers.length) throw new Error(`${name}: contiene columnas duplicadas.`);
  return rows.map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`${name}, fila ${index + 2}: se esperaban ${headers.length} columnas y hay ${values.length}.`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
  });
}

export function validateColumns(rows, required, name) {
  if (!rows.length) throw new Error(`${name}: no contiene datos.`);
  const missing = required.filter(column => !(column in rows[0]));
  if (missing.length) throw new Error(`${name}: faltan columnas: ${missing.join(", ")}.`);
}
