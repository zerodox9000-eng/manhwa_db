function isEnglishToomicsLink(value) {
  try {
    const url = new URL(String(value || "").trim());
    return (
      url.hostname.toLowerCase() === "global.toomics.com" &&
      url.pathname.toLowerCase().startsWith("/en/")
    );
  } catch {
    return false;
  }
}

function getEnglishReadLinks(series) {
  const allLinks = Array.isArray(series?.links_v2) ? series.links_v2 : [];

  return [
    ...new Set(
      allLinks
        .filter(
          (link) =>
            link?.type === "webplatform" &&
            (link?.language === "en" || isEnglishToomicsLink(link?.url))
        )
        .map((link) => String(link.url || "").trim())
        .filter(Boolean)
    ),
  ];
}

module.exports = {
  getEnglishReadLinks,
  isEnglishToomicsLink,
};
