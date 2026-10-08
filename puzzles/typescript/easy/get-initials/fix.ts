// Upper-case initials of a full name: "ada  lovelace" -> "AL".
// Extra spaces around or between the names are ignored.
function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map((part) => part[0].toUpperCase())
    .join("");
}
