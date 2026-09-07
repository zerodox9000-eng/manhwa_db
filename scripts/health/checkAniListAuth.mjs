const endpoint = "https://graphql.anilist.co";

function tokenShape(rawToken) {
  const trimmedToken = rawToken.trim();

  return {
    rawLength: rawToken.length,
    trimmedLength: trimmedToken.length,
    hasLeadingOrTrailingWhitespace: rawToken !== trimmedToken,
    hasAccessTokenWrapper: /^access_token=/i.test(trimmedToken),
    hasBearerWrapper: /^Bearer\s+/i.test(trimmedToken),
    hasQuerySeparators: /[&#]/.test(trimmedToken),
    hasQuotes: /["']/.test(trimmedToken),
    jwtLike: /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmedToken),
  };
}

function errorSummary(payload) {
  if (!Array.isArray(payload?.errors)) return "";

  const details = payload.errors.slice(0, 3).map((error) => ({
    status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
    message: String(error?.message || "Unknown AniList error").slice(0, 200),
  }));

  return ` ${JSON.stringify(details)}`;
}

async function main() {
  const token = String(process.env.ANILIST_ACCESS_TOKEN || "").trim();

  if (!token) {
    console.error("AniList auth check: ANILIST_ACCESS_TOKEN is missing.");
    return 2;
  }

  console.log(`AniList auth input shape: ${JSON.stringify(tokenShape(process.env.ANILIST_ACCESS_TOKEN || ""))}`);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: "query AniListAuthCheck { Viewer { id } }",
      }),
    });
  } catch {
    console.error("AniList auth check: NETWORK_ERROR");
    return 1;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Keep the diagnostic output independent of AniList's response format.
  }

  if (response.ok && Number.isInteger(payload?.data?.Viewer?.id)) {
    console.log("AniList auth check: OK");
    return 0;
  }

  if (response.status === 401 || response.status === 400) {
    console.error(`AniList auth check: INVALID_TOKEN_OR_REQUEST${errorSummary(payload)}`);
  } else if (response.status === 403) {
    console.error(`AniList auth check: SERVICE_FORBIDDEN (AniList returned 403; this does not prove the token is invalid)${errorSummary(payload)}`);
  } else {
    console.error(`AniList auth check: FAILED_HTTP_${response.status}${errorSummary(payload)}`);
  }

  return 1;
}

process.exitCode = await main();
