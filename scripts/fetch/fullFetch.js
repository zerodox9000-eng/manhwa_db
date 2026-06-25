require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API = process.env.MANGABAKA_API;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(year, page = 1) {

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  try {

    const response = await axios.get(
      `${API}/v1/series/search`,
      {
        params: {
          type: "manhwa",
          published_start_date_lower: startDate,
          published_start_date_upper: endDate,
          page,
          limit: 100
        }
      }
    );

    return response.data;

  } catch (error) {

    const status = error.response?.status;

    if (status === 429 || status === 502) {

      console.log(
        `Error ${status}. Waiting 60 seconds...`
      );

      await sleep(60000);

      return fetchPage(year, page);
    }

    console.log(
      error.response?.data || error.message
    );

    throw error;
  }
}

async function fetchYear(year) {

  console.log(`YEAR ${year}`);

  let allSeries = [];

  let page = 1;

  const output = path.join(
    __dirname,
    `../../db/raw/by-year/${year}.json`
  );

  while (true) {

    console.log(
      `Fetching ${year} page ${page}`
    );

    const data = await fetchPage(year, page);

    const series = data.data || [];

    if (series.length === 0) {

      console.log(
        `No more results for ${year}`
      );

      break;
    }

    allSeries.push(...series);

    fs.writeFileSync(
      output,
      JSON.stringify(allSeries, null, 2),
      "utf-8"
    );

    console.log(
      `Saved ${allSeries.length} entries`
    );

    page++;

    await sleep(2000);
  }

  console.log(
    `Finished ${year}`
  );
}

async function main() {

  for (let year = 2013; year <= 2026; year++) {

    await fetchYear(year);

    await sleep(5000);
  }

  console.log("Finished all years.");
}

main().catch(console.error);


