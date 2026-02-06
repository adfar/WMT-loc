/**
 * Automated Walmart Store Data Collector
 *
 * This script automatically collects all Walmart store data and tracks progress.
 * Run with: node auto-collect.js
 *
 * Progress is saved after each state, so you can stop and resume.
 */

const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'https://www.walmart.com';
const PROGRESS_FILE = 'collection-progress.json';
const STORES_FILE = 'stores.js';

const STATES = {
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

function loadProgress() {
    try {
        if (fs.existsSync(PROGRESS_FILE)) {
            return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        }
    } catch (e) {
        console.log('Starting fresh progress tracking');
    }
    return {
        lastUpdated: new Date().toISOString().split('T')[0],
        totalStoresCollected: 0,
        statesCompleted: [],
        statesInProgress: [],
        statesPending: Object.keys(STATES),
        stores: {}
    };
}

function saveProgress(progress) {
    progress.lastUpdated = new Date().toISOString().split('T')[0];
    progress.totalStoresCollected = Object.keys(progress.stores).length;
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

    // Also update the stores.js file
    const storesContent = `// Walmart Store Data
// Auto-generated: ${new Date().toISOString()}
// Total stores: ${progress.totalStoresCollected}
// States completed: ${progress.statesCompleted.length}/${Object.keys(STATES).length}

const STORES = ${JSON.stringify(progress.stores, null, 4)};
`;
    fs.writeFileSync(STORES_FILE, storesContent);
    console.log(`Progress saved: ${progress.totalStoresCollected} stores collected`);
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function collectStoreData(page, storeNum) {
    try {
        await page.goto(`${BASE_URL}/store/${storeNum}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await delay(1500);

        const data = await page.evaluate(() => {
            const getText = (selector) => {
                const el = document.querySelector(selector);
                return el ? el.textContent.trim() : '';
            };

            // Find store info from the page
            const heading = document.querySelector('h1, h2');
            const name = heading ? heading.textContent.trim() : '';

            // Look for store type and number
            let type = 'Walmart';
            const typeMatch = document.body.innerText.match(/Walmart (Supercenter|Neighborhood Market) #(\d+)/);
            if (typeMatch) {
                type = typeMatch[1];
            }

            // Find address
            let address = '';
            let city = '';
            let state = '';
            const addressMatch = document.body.innerText.match(/(\d+[^,]+),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})/);
            if (addressMatch) {
                address = `${addressMatch[1].trim()}, ${addressMatch[2].trim()}, ${addressMatch[3]} ${addressMatch[4]}`;
                city = addressMatch[2].trim();
                state = addressMatch[3];
            }

            // Find phone
            let phone = '';
            const phoneLink = document.querySelector('a[href^="tel:"]');
            if (phoneLink) {
                phone = phoneLink.href.replace('tel:', '');
                // Format phone number
                if (phone.length === 10) {
                    phone = `${phone.slice(0,3)}-${phone.slice(3,6)}-${phone.slice(6)}`;
                }
            }

            return { name, type, address, phone, city, state };
        });

        if (data.address && data.phone) {
            return data;
        }
        return null;
    } catch (e) {
        console.log(`  Error collecting store #${storeNum}: ${e.message}`);
        return null;
    }
}

async function collectState(page, stateCode, progress) {
    console.log(`\n=== Collecting ${STATES[stateCode]} (${stateCode.toUpperCase()}) ===`);

    // Get list of cities in this state
    await page.goto(`${BASE_URL}/store-directory/${stateCode}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);

    const cityLinks = await page.evaluate((stateCode) => {
        const links = Array.from(document.querySelectorAll(`a[href*="/store-directory/${stateCode}/"]`));
        return links.map(a => a.href).filter(href => href.includes(`/store-directory/${stateCode}/`));
    }, stateCode);

    console.log(`Found ${cityLinks.length} cities in ${STATES[stateCode]}`);

    let totalCollected = 0;

    // Visit each city and collect store data directly from city page
    for (const cityUrl of cityLinks) {
        try {
            await page.goto(cityUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await delay(1500);

            // Extract all store data from the city page
            const stores = await page.evaluate(() => {
                const results = [];
                const main = document.querySelector('main');
                if (!main) return results;

                const storeLinks = main.querySelectorAll('a[href^="/store/"]');

                storeLinks.forEach(link => {
                    const match = link.href.match(/\/store\/(\d+)-/);
                    if (!match) return;

                    const storeNum = match[1];
                    const parent = link.parentElement;
                    if (!parent) return;

                    // Get store type from link text
                    const type = link.textContent.replace('Check ', '').replace(/#\d+/, '').trim();

                    // Get all text content from the card
                    const fullText = parent.innerText;
                    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

                    let street = '';
                    let city = '';
                    let state = '';
                    let zip = '';
                    let phone = '';

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];

                        // Check for phone pattern
                        const phoneMatch = line.match(/(\d{3}[-.]?\d{3}[-.]?\d{4})/);
                        if (phoneMatch) {
                            phone = phoneMatch[1];
                            continue;
                        }

                        // Check for city, state zip pattern
                        const cityStateMatch = line.match(/^([^,]+),\s*([A-Z]{2})\s+(\d{5})$/);
                        if (cityStateMatch) {
                            city = cityStateMatch[1];
                            state = cityStateMatch[2];
                            zip = cityStateMatch[3];
                            continue;
                        }

                        // If it looks like a street address
                        if (!line.includes('Walmart') && !line.includes('Check') && !line.includes('Call')) {
                            if (/^\d/.test(line) || /\b(St|Ave|Rd|Blvd|Dr|Hwy|Way|Ln|Ct|Pl)\b/i.test(line)) {
                                street = line;
                            }
                        }
                    }

                    if (storeNum && phone && city) {
                        results.push({
                            number: storeNum,
                            name: city + ' ' + type,
                            type: type,
                            address: street + ', ' + city + ', ' + state + ' ' + zip,
                            phone: phone,
                            city: city,
                            state: state
                        });
                    }
                });

                return results;
            });

            const cityName = decodeURIComponent(cityUrl.split('/').pop());
            let cityCollected = 0;

            // Add stores to progress
            for (const store of stores) {
                if (progress.stores[store.number]) {
                    console.log(`    Store #${store.number} already collected, skipping`);
                    cityCollected++;
                    continue;
                }

                progress.stores[store.number] = store;
                cityCollected++;
                totalCollected++;
                console.log(`    Collected #${store.number}: ${store.name}`);
            }

            console.log(`  ${cityName}: ${cityCollected} stores`);

            // Save progress after each city
            if (cityCollected > 0) {
                saveProgress(progress);
            }
        } catch (e) {
            console.log(`  Error processing city: ${e.message}`);
        }
    }

    console.log(`Total stores collected in ${STATES[stateCode]}: ${totalCollected}`);
    return totalCollected;
}

async function main() {
    console.log('===========================================');
    console.log('  Walmart Store Data Collector');
    console.log('===========================================');
    console.log('');

    const progress = loadProgress();
    console.log(`Resuming collection...`);
    console.log(`States completed: ${progress.statesCompleted.length}/${Object.keys(STATES).length}`);
    console.log(`Stores already collected: ${Object.keys(progress.stores).length}`);
    console.log('');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        // Process each state
        for (const stateCode of Object.keys(STATES)) {
            if (progress.statesCompleted.includes(stateCode)) {
                console.log(`Skipping ${STATES[stateCode]} (already completed)`);
                continue;
            }

            // Mark state as in progress
            progress.statesInProgress = [stateCode];
            progress.statesPending = progress.statesPending.filter(s => s !== stateCode);
            saveProgress(progress);

            // Collect stores from this state
            await collectState(page, stateCode, progress);

            // Mark state as completed
            progress.statesCompleted.push(stateCode);
            progress.statesInProgress = [];
            saveProgress(progress);

            console.log(`\n${STATES[stateCode]} completed!`);
            console.log(`Total progress: ${progress.statesCompleted.length}/${Object.keys(STATES).length} states`);
            console.log(`Total stores: ${Object.keys(progress.stores).length}`);
        }

        console.log('\n===========================================');
        console.log('  COLLECTION COMPLETE!');
        console.log(`  Total stores: ${Object.keys(progress.stores).length}`);
        console.log(`  States: ${progress.statesCompleted.length}/${Object.keys(STATES).length}`);
        console.log('===========================================');

    } catch (e) {
        console.error('Fatal error:', e);
        saveProgress(progress);
    } finally {
        await browser.close();
    }
}

main();
