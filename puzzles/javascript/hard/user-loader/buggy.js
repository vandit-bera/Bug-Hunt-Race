// Loads user profiles through an API client with two async methods:
//   api.getUser(id)   -> { id, name }   (rejects with error.code "NOT_FOUND")
//   api.getPosts(id)  -> [{ title, draft }]
//
// The helpers below never talk to the network themselves; they only combine
// what the client returns.

// One user plus the number of published (non-draft) posts.
async function loadUser(api, id) {
  const [user, posts] = await Promise.all([api.getUser(id), api.getPosts(id)]);
  const published = posts;
  return { ...user, postCount: published.length };
}

// Loads many users in parallel and keeps the order of `ids`.
// Unknown users (NOT_FOUND) are left out; any other error rejects the call.
async function loadUsers(api, ids) {
  const loaded = await Promise.all(
    ids.map(async (id) => {
      try {
        return loadUser(api, id);
      } catch (error) {
        return null;
      }
    }),
  );
  return loaded.filter((user) => user !== null);
}

// Names of all found users as one comma separated string.
async function userNames(api, ids) {
  const users = await loadUsers(api, ids);
  return users.map((user) => user.name).join(", ");
}

// The found user with the most published posts, or null when nobody is found.
// On a tie the user listed first wins.
async function mostActiveUser(api, ids) {
  const users = await loadUsers(api, ids);
  let best = null;
  for (const user of users) {
    if (best === null || user.postCount > best.postCount) best = user;
  }
  return best;
}

// How many of the given ids belong to real users.
async function countFound(api, ids) {
  const users = await loadUsers(api, ids);
  return users.length;
}
