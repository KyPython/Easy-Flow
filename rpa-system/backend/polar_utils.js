const axios = require('axios');
require('dotenv').config();

const POLAR_API_KEY = process.env.POLAR_API_KEY;
const POLAR_API_BASE_URL = process.env.POLAR_API_BASE_URL;

/**
 * Fetches the current status of a single subscription directly from the Polar API.
 *
 * @param {string} polarSubscriptionId The ID of the Polar subscription (e.g., 'sub_123...').
 * @returns {Promise<object|null>} The subscription object from Polar, or null if not found or an error occurs.
 */
async function getPolarSubscription(polarSubscriptionId) {
  if (!POLAR_API_KEY) {
    console.error('Error: POLAR_API_KEY is not configured.');
    return null;
  }

  if (!polarSubscriptionId) {
    console.error('Error: A Polar subscription ID is required.');
    return null;
  }

  try {
    console.log(`Fetching subscription ${polarSubscriptionId} from Polar...`);
    const response = await axios.get(`${POLAR_API_BASE_URL}/subscriptions/${polarSubscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${POLAR_API_KEY}`,
        'Accept': 'application/json',
      },
      timeout: 8000, // 8-second timeout
    });

    return response.data;

  } catch (error) {
    console.error(`Error fetching subscription ${polarSubscriptionId} from Polar:`);
    if (error.response) {
      console.error(`Status: ${error.response.status} - ${error.response.data?.detail || 'No details'}`);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

module.exports = { getPolarSubscription };
