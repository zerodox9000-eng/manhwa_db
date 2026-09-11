const assert = require("node:assert/strict");
const test = require("node:test");
const { getEnglishReadLinks, isEnglishToomicsLink } = require("./englishReadLinks");

test("recognizes Toomics Global English URLs even when raw language is ko", () => {
  assert.equal(
    isEnglishToomicsLink("https://global.toomics.com/en/webtoon/episode/toon/5125"),
    true
  );
  assert.deepEqual(
    getEnglishReadLinks({
      links_v2: [
        {
          language: "ko",
          type: "webplatform",
          url: "https://global.toomics.com/en/webtoon/episode/toon/5125",
        },
        {
          language: "ko",
          type: "webplatform",
          url: "https://global.toomics.com/ko/webtoon/episode/toon/5125",
        },
        {
          language: "en",
          type: "webplatform",
          url: "https://www.lezhinus.com/en/comic/example",
        },
      ],
    }),
    [
      "https://global.toomics.com/en/webtoon/episode/toon/5125",
      "https://www.lezhinus.com/en/comic/example",
    ]
  );
});
