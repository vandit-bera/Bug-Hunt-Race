const database = {
  1: {
    name: "Ada",
    posts: [{ draft: false }, { draft: false }, { draft: true }],
  },
  2: { name: "Bo", posts: [{ draft: false }] },
  3: { name: "Cy", posts: [{ draft: true }, { draft: true }] },
  9: { name: "Broken", broken: true, posts: [] },
};

const api = {
  async getUser(id) {
    const row = database[id];
    if (!row) {
      const error = new Error(`no user ${id}`);
      error.code = "NOT_FOUND";
      throw error;
    }
    if (row.broken) throw new Error("database is down");
    return { id, name: row.name };
  },
  async getPosts(id) {
    return database[id] ? database[id].posts : [];
  },
};

async function errorFrom(promise) {
  try {
    await promise;
  } catch (error) {
    return error.message;
  }
  return "no error";
}

test("counts only published posts", async () => {
  expect(await loadUser(api, 1)).toEqual({ id: 1, name: "Ada", postCount: 2 });
  expect((await loadUser(api, 3)).postCount).toBe(0);
});
test("loads users in the order of the ids", async () => {
  expect(await userNames(api, [2, 1, 3])).toBe("Bo, Ada, Cy");
});
test("leaves out users that do not exist", async () => {
  expect(await userNames(api, [1, 404, 2])).toBe("Ada, Bo");
  expect(await countFound(api, [404, 405])).toBe(0);
});
test("any other error rejects the whole call", async () => {
  expect(await errorFrom(loadUsers(api, [1, 9, 2]))).toBe("database is down");
});
test("finds the most active user", async () => {
  expect((await mostActiveUser(api, [2, 1, 3])).name).toBe("Ada");
  expect(await mostActiveUser(api, [404])).toBe(null);
});
