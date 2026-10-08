// Returns the sum of the even numbers in `nums`.
function sumOfEvens(nums) {
  let total = 0;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] % 2 === 0) {
      total += nums[i];
    }
  }
  return total;
}
