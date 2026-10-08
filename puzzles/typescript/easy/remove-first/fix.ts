// Returns a copy of `items` without the first occurrence of `target`.
// If `target` is not there, the copy has the same items.
function removeFirst<T>(items: T[], target: T): T[] {
  const copy = [...items];
  const index = copy.indexOf(target);
  if (index !== -1) copy.splice(index, 1);
  return copy;
}
