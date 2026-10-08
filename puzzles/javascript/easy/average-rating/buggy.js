// Average of the ratings, ignoring unrated reviews (null).
function averageRating(ratings) {
  let total = 0;
  let count = 0;
  for (const rating of ratings) {
    if (rating === null) continue;
    total += rating;
    count += 1;
  }
  if (count === 0) return 0;
  return total / ratings.length;
}
