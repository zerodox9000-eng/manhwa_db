const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getEnglishReadLinks,
  isEnglishLocalizedLink,
} = require("./englishReadLinks");

test("recognizes explicit English platform paths even when raw language is not en", () => {
  assert.equal(
    isEnglishLocalizedLink("https://global.toomics.com/en/webtoon/episode/toon/5125"),
    true
  );
  assert.equal(
    isEnglishLocalizedLink("https://www.lalatoon.com/en/webtoon/episode/toon/6566"),
    true
  );
  assert.equal(
    isEnglishLocalizedLink("https://toomics.com/ko/webtoon/episode/toon/6566"),
    false
  );
  assert.equal(
    isEnglishLocalizedLink("https://global.toptoon.com/content/100247"),
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
          language: "ko",
          type: "webplatform",
          url: "https://www.lalatoon.com/en/webtoon/episode/toon/6566",
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
      "https://www.lalatoon.com/en/webtoon/episode/toon/6566",
      "https://www.lezhinus.com/en/comic/example",
    ]
  );
});
