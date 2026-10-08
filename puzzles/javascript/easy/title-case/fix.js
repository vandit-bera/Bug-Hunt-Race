// Capitalises every word: "hELLO wORLD" -> "Hello World".
function titleCase(sentence) {
  const words = sentence.split(" ");
  const result = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    result.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
  return result.join(" ");
}
