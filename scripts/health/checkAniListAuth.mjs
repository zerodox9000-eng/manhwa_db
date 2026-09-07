const endpoint = "https://graphql.anilist.co";

async function main() {
  const token = String(process.env.ANILIST_ACCESS_TOKEN || "").trim();

  if (!token) {
    console.error("AniList auth check: ANILIST_ACCESS_TOKEN is missing.");
    return 2;
  }

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
    console.error("AniList auth check: INVALID_TOKEN_OR_REQUEST");
  } else if (response.status === 403) {
    console.error("AniList auth check: SERVICE_FORBIDDEN (AniList returned 403; this does not prove the token is invalid)");
  } else {
    console.error(`AniList auth check: FAILED_HTTP_${response.status}`);
  }

  return 1;
}

process.exitCode = await main();
