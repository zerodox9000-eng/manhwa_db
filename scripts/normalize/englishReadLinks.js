function isEnglishLocalizedLink(value) {
  try {
    const url = new URL(String(value || "").trim());
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    return (
      pathname === "/en" ||
      pathname.startsWith("/en/") ||
      (hostname === "global.toptoon.com" && pathname.startsWith("/content/"))
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
            (link?.language === "en" || isEnglishLocalizedLink(link?.url))
        )
        .map((link) => String(link.url || "").trim())
        .filter(Boolean)
    ),
  ];
}

module.exports = {
  getEnglishReadLinks,
  isEnglishLocalizedLink,
};
