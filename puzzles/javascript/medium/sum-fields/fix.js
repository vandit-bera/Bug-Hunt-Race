// Adds up the filled-in fields (blank ones are skipped), rounded to 2 decimals.
function sumFields(values) {
  let total = 0;
  for (const value of values) {
    if (value.trim() === "") continue;
    total += Number(value);
  }
  return Math.round(total * 100) / 100;
}

// Number of fields that were filled in.
function countFilled(values) {
  return values.filter((value) => value.trim() !== "").length;
}

// Average of the filled-in fields, or 0 when all of them are blank.
function averageField(values) {
  const filled = countFilled(values);
  return filled === 0 ? 0 : sumFields(values) / filled;
}
