const cron = require("node-cron");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

// Function to log messages to both console and file
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}\n`;
  console.log(message);
  fs.appendFile("exchange_rate_log.txt", logMessage, (err) => {
    if (err) console.error("Error writing to log file:", err);
  });
}

// Initialize SQLite database
const db = new sqlite3.Database("./exchange_rates.db", (err) => {
  if (err) {
    log(`Error opening database: ${err}`);
  } else {
    log("Connected to the SQLite database.");
    db.run(`CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      rate REAL
    )`);
  }
});

// Function to fetch INR to USD exchange rate and store in SQLite
async function getAndStoreINRtoUSDRate() {
  try {
    const response = await axios.get(
      "https://api.exchangerate-api.com/v4/latest/INR"
    );
    const usdRate = response.data.rates.USD;
    const date = new Date().toISOString().split("T")[0];

    db.run(
      `INSERT INTO exchange_rates (date, rate) VALUES (?, ?)`,
      [date, usdRate],
      function (err) {
        if (err) {
          log(`Error inserting data: ${err.message}`);
        } else {
          log(`Stored in DB: 1 INR = ${usdRate} USD on ${date}`);
        }
      }
    );
  } catch (error) {
    log(`Error fetching exchange rate: ${error.message}`);
  }
}

// Function to get the latest rate from the database
function getLatestRate() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM exchange_rates ORDER BY id DESC LIMIT 1`,
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
}

// Run the exchange rate check immediately on startup
log("Running initial INR to USD exchange rate check");
getAndStoreINRtoUSDRate();

// Schedule the cron job to run once a day at midnight
cron.schedule("0 0 * * *", () => {
  log("Running daily INR to USD exchange rate check");
  getAndStoreINRtoUSDRate();
});

log("Cron job scheduled. Waiting for next execution...");

// Example of how to use the latest rate
setInterval(async () => {
  try {
    const latestRate = await getLatestRate();
    log(
      `Latest rate in DB: 1 INR = ${latestRate.rate} USD on ${latestRate.date}`
    );
  } catch (error) {
    log(`Error getting latest rate: ${error.message}`);
  }
}, 60000); // Check every minute (for demonstration purposes)
