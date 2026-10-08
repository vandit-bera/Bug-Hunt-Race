// A year is a leap year when it is divisible by 4, except century years,
// which must also be divisible by 400.
function isLeapYear(year: number): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return true;
  return year % 4 === 0;
}
