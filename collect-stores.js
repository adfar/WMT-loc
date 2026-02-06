/**
 * Walmart Store Data Collection Script
 * 
 * This script uses Playwright to collect store information from the Walmart directory.
 * 
 * Usage:
 *   1. Install dependencies: npm install playwright
 *   2. Run: node collect-stores.js
 * 
 * The script will:
 *   - Navigate through each state in the store directory
 *   - Visit each city to get store listings
 *   - Extract store information (number, name, address, phone)
 *   - Save results to stores-data.json
 */

const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'https://www.walmart.com';
const STORE_DIRECTORY_URL = `${BASE_URL}/store-directory`;

// State abbreviations
const STATES = [
    'ak', 'al', 'ar', 'az', 'ca', 'co', 'ct', 'dc', 'de', 'fl',
    'ga', 'hi', 'ia', 'id', 'il', 'in', 'ks', 'ky', 'la', 'ma',
    'md', 'me', 'mi', 'mn', 'mo', 'ms', 'mt', 'nc', 'nd', 'ne',
    'nh', 'nj', 'nm', 'nv', 'ny', 'oh', 'ok', 'or', 'pa', 'ri',
    'sc', 'sd', 'tn', 'tx', 'ut', 'va', 'vt', 'wa', 'wi', 'wv', 'wy'
];

const STATE_NAMES = {
    'ak': 'Alaska', 'al': 'Alabama', 'ar': 'Arkansas', 'az': 'Arizona',
    'ca': 'California', 'co': 'Colorado', 'ct': 'Connecticut', 'dc': 'District of Columbia',
    'de': 'Delaware', 'fl': 'Florida', 'ga': 'Georgia', 'hi': 'Hawaii',
    'ia': 'Iowa', 'id': 'Idaho', 'il': 'Illinois', 'in': 'Indiana',
    'ks': 'Kansas', 'ky': 'Kentucky', 'la': 'Louisiana', 'ma': 'Massachusetts',
    'md': 'Maryland', 'me': 'Maine', 'mi': 'Michigan', 'mn': 'Minnesota',
    'mo': 'Missouri', 'ms': 'Mississippi', 'mt': 'Montana', 'nc': 'North Carolina',
    'nd': 'North Dakota', 'ne': 'Nebraska', 'nh': 'New Hampshire', 'nj': 'New Jersey',
    'nm': 'New Mexico', 'nv': 'Nevada', 'ny': 'New York', 'oh': 'Ohio',
    'ok': 'Oklahoma', 'or': 'Oregon', 'pa': 'Pennsylvania', 'ri': 'Rhode Island',
    'sc': 'South Carolina', 'sd': 'South Dakota', 'tn': 'Tennessee', 'tx': 'Texas',
    'ut': 'Utah', 'va': 'Virginia', 'vt': 'Vermont', 'wa': 'Washington',
    'wi': 'Wisconsin', 'wv': 'West Virginia', 'wy': 'Wyoming'
};

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function collectStoreData() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const stores = {};
    let totalCollected = 0;

    try {
        for (const state of STATES) {
            console.log(`\nCollecting stores from ${STATE_NAMES[state]}...`);

            // Navigate to state page
            await page.goto(`${STORE_DIRECTORY_URL}/${state}`, { waitUntil: 'networkidle' });
            await delay(1000);

            // Get all city links
            const cityLinks = await page.$$eval('a[href*="/store-directory/"]', links => {
                return links
                    .filter(a => a.href.includes(`/store-directory/`) && a.href.split('/').length > 5)
                    .map(a => a.href);
            });

            console.log(`  Found ${cityLinks.length} cities`);

            for (const cityUrl of cityLinks) {
                try {
                    await page.goto(cityUrl, { waitUntil: 'networkidle' });
                    await delay(500);

                    // Get store links from city page
                    const storeLinks = await page.$$eval('a[href^="/store/"]', links => {
                        return links
                            .filter(a => a.href.match(/\/store\/\d+/))
                            .map(a => {
                                const match = a.href.match(/\/store\/(\d+)/);
                                return match ? match[1] : null;
                            })
                            .filter(Boolean);
                    });

                    // Remove duplicates
                    const uniqueStoreIds = [...new Set(storeLinks)];

                    for (const storeId of uniqueStoreIds) {
                        if (stores[storeId]) continue; // Already collected

                        try {
                            await page.goto(`${BASE_URL}/store/${storeId}`, { waitUntil: 'networkidle' });
                            await delay(500);

                            // Extract store data
                            const storeData = await page.evaluate(() => {
                                const nameEl = document.querySelector('h1, h2');
                                const typeEl = document.querySelector('[class*="StoreHeader"] span, .f6');
                                const addressEl = document.querySelectorAll('[class*="StoreHeader"] div');
                                
                                let name = '';
                                let type = '';
                                let address = '';
                                let phone = '';
                                let city = '';
                                let stateAbbr = '';

                                // Try to find the store name and type
                                const allText = document.body.innerText;
                                const supercenterMatch = allText.match(/Walmart Supercenter #(\d+)/);
                                const neighborhoodMatch = allText.match(/Neighborhood Market #(\d+)/);
                                const storeMatch = allText.match(/Walmart #(\d+)/);

                                if (supercenterMatch) {
                                    type = 'Supercenter';
                                } else if (neighborhoodMatch) {
                                    type = 'Neighborhood Market';
                                } else if (storeMatch) {
                                    type = 'Walmart';
                                }

                                // Find address - look for text that looks like an address
                                const addressMatch = allText.match(/(\d+\s+[A-Za-z0-9\s,\.]+,\s*[A-Z]{2}\s+\d{5})/);
                                if (addressMatch) {
                                    const fullAddress = addressMatch[1];
                                    const parts = fullAddress.split(',');
                                    if (parts.length >= 2) {
                                        address = parts[0].trim();
                                        const cityStateZip = parts.slice(1).join(',').trim();
                                        const cityMatch = cityStateZip.match(/([^,]+),?\s*([A-Z]{2})\s+(\d{5})/);
                                        if (cityMatch) {
                                            city = cityMatch[1].trim();
                                            stateAbbr = cityMatch[2];
                                            address = `${address}, ${city}, ${stateAbbr} ${cityMatch[3]}`;
                                        }
                                    }
                                }

                                // Find phone number
                                const phoneLink = document.querySelector('a[href^="tel:"]');
                                if (phoneLink) {
                                    phone = phoneLink.href.replace('tel:', '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
                                }

                                // Get name from heading
                                const heading = document.querySelector('h1');
                                if (heading) {
                                    name = heading.innerText.replace(/Supercenter|Neighborhood Market|Store/gi, '').trim();
                                }

                                return { name, type, address, phone, city, state: stateAbbr };
                            });

                            if (storeData.address) {
                                stores[storeId] = {
                                    number: storeId,
                                    name: storeData.name || `Walmart #${storeId}`,
                                    type: storeData.type || 'Walmart',
                                    address: storeData.address,
                                    phone: storeData.phone,
                                    city: storeData.city,
                                    state: storeData.state
                                };
                                totalCollected++;
                                console.log(`    Collected store #${storeId} (Total: ${totalCollected})`);
                            }
                        } catch (err) {
                            console.log(`    Error collecting store #${storeId}: ${err.message}`);
                        }
                    }
                } catch (err) {
                    console.log(`  Error processing city: ${err.message}`);
                }
            }

            // Save progress after each state
            fs.writeFileSync('stores-data.json', JSON.stringify(stores, null, 2));
            console.log(`  Saved progress: ${Object.keys(stores).length} stores`);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }

    // Generate stores.js file
    const storesJs = `// Walmart Store Data
// Auto-generated on ${new Date().toISOString()}
// Total stores: ${Object.keys(stores).length}

const STORES = ${JSON.stringify(stores, null, 2)};
`;

    fs.writeFileSync('stores.js', storesJs);
    console.log(`\nDone! Collected ${Object.keys(stores).length} stores.`);
    console.log('Files created: stores-data.json, stores.js');
}

// Run the collector
collectStoreData();
