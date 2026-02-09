/**
 * Walmart Store Phone Number Merge Utility
 *
 * Merges phone number data (from phone-data.json) into stores.js.
 * Phone data is collected via Chrome browser automation and saved
 * as a JSON mapping of store numbers to phone numbers.
 *
 * Usage:
 *   node enrich-phones.js                # Merge phone-data.json into stores.js
 *   node enrich-phones.js --stats        # Show enrichment statistics only
 */

const fs = require('fs');

const STORES_FILE = 'stores.js';
const PHONE_DATA_FILE = 'phone-data.json';
const PROGRESS_FILE = 'phone-enrichment-progress.json';

function loadStores() {
    const content = fs.readFileSync(STORES_FILE, 'utf8');
    const match = content.match(/const STORES = ({[\s\S]*});?\s*$/);
    if (!match) {
        throw new Error('Could not parse stores.js — expected "const STORES = {...};"');
    }
    return JSON.parse(match[1]);
}

function saveStores(stores) {
    const content = `// Walmart Store Data
// Auto-generated: ${new Date().toISOString()}
// Total stores: ${Object.keys(stores).length}

const STORES = ${JSON.stringify(stores, null, 4)};
`;
    fs.writeFileSync(STORES_FILE, content);
}

function loadPhoneData() {
    if (!fs.existsSync(PHONE_DATA_FILE)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(PHONE_DATA_FILE, 'utf8'));
}

function savePhoneData(phoneData) {
    fs.writeFileSync(PHONE_DATA_FILE, JSON.stringify(phoneData, null, 2));
}

function loadProgress() {
    try {
        if (fs.existsSync(PROGRESS_FILE)) {
            return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        }
    } catch (e) {}
    return { lastUpdated: null, statesCompleted: [], totalPhonesCollected: 0 };
}

function saveProgress(progress) {
    progress.lastUpdated = new Date().toISOString();
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function main() {
    const args = process.argv.slice(2);
    const statsOnly = args.includes('--stats');

    const stores = loadStores();
    const phoneData = loadPhoneData();
    const totalStores = Object.keys(stores).length;

    if (statsOnly) {
        const withPhone = Object.values(stores).filter(s => s.phone).length;
        const phonesAvailable = Object.keys(phoneData).length;
        console.log(`Total stores:          ${totalStores}`);
        console.log(`Stores with phone:     ${withPhone}`);
        console.log(`Stores without phone:  ${totalStores - withPhone}`);
        console.log(`Phones in data file:   ${phonesAvailable}`);
        console.log(`Coverage:              ${((withPhone / totalStores) * 100).toFixed(1)}%`);
        return;
    }

    const phoneEntries = Object.keys(phoneData);
    if (phoneEntries.length === 0) {
        console.log('No phone data found in phone-data.json. Nothing to merge.');
        return;
    }

    let merged = 0;
    let skipped = 0;
    let notFound = 0;

    for (const [storeNum, phone] of Object.entries(phoneData)) {
        if (!stores[storeNum]) {
            notFound++;
            continue;
        }
        if (stores[storeNum].phone && stores[storeNum].phone === phone) {
            skipped++;
            continue;
        }
        stores[storeNum].phone = phone;
        merged++;
    }

    saveStores(stores);

    const withPhone = Object.values(stores).filter(s => s.phone).length;
    console.log(`Merged:    ${merged} new phone numbers`);
    console.log(`Skipped:   ${skipped} (already had same phone)`);
    console.log(`Not found: ${notFound} (store not in database)`);
    console.log(`Coverage:  ${withPhone}/${totalStores} (${((withPhone / totalStores) * 100).toFixed(1)}%)`);
}

main();
