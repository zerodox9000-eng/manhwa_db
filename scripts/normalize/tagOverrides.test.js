const assert = require("node:assert/strict");
const test = require("node:test");
const { applyTagOverrides, loadTagOverrides } = require("./tagOverrides");

test("removes only the audited Crimson Reset Boys Love tag", () => {
  const overrides = loadTagOverrides();
  const tags = [
    { id: 180, name: "Boys Love" },
    { id: 1, name: "Action" },
  ];

  assert.deepEqual(
    applyTagOverrides({ id: 567763, tags_v2: tags }, overrides),
    [{ id: 1, name: "Action" }]
  );
  assert.deepEqual(
    applyTagOverrides({ id: 567764, tags_v2: tags }, overrides),
    tags
  );
});
