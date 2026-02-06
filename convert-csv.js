/**
 * Convert WMT_stores.csv to stores.js format
 */

const fs = require('fs');

// Read CSV
const csv = fs.readFileSync('WMT_stores.csv', 'utf8');
const lines = csv.split('\n').filter(line => line.trim());

// Skip header and parse
const header = lines[0].split(',');
const stores = {};

// Find column indices
const cols = {
    number: header.findIndex(h => h.includes('businessUnit_number')),
    name: header.findIndex(h => h.includes('businessUnit_name')),
    description: header.findIndex(h => h.includes('Description')),
    address: header.findIndex(h => h.includes('Address')),
    city: header.findIndex(h => h.includes('City')),
    state: header.findIndex(h => h.includes('State')),
    zip: header.findIndex(h => h.includes('Postal Code')),
    status: header.findIndex(h => h.includes('Operation Status'))
};

console.log('Column indices:', cols);

// Parse each line
for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Handle CSV parsing (fields may contain commas in quotes)
    const fields = [];
    let field = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            fields.push(field.trim());
            field = '';
        } else {
            field += char;
        }
    }
    fields.push(field.trim());

    const storeNum = fields[cols.number];
    const status = fields[cols.status];

    // Only include open stores
    if (!storeNum || status !== 'Open') continue;

    const city = fields[cols.city] || '';
    const stateCode = fields[cols.state] || '';
    const zip = fields[cols.zip] || '';
    const address = fields[cols.address] || '';
    const description = fields[cols.description] || 'Walmart';

    // Determine store type
    let type = 'Supercenter';
    if (description.includes('Neighborhood')) {
        type = 'Neighborhood Market';
    } else if (description.includes('Supercenter')) {
        type = 'Supercenter';
    } else if (description.includes('Sam')) {
        type = "Sam's Club";
    }

    // Format city name (title case)
    const cityFormatted = city.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');

    stores[storeNum] = {
        number: storeNum,
        name: `${cityFormatted} ${type}`,
        type: type,
        address: `${address}, ${cityFormatted}, ${stateCode} ${zip}`,
        phone: '', // CSV doesn't have phone numbers
        city: cityFormatted,
        state: stateCode
    };
}

console.log(`Parsed ${Object.keys(stores).length} stores`);

// Write stores.js
const storesContent = `// Walmart Store Data
// Auto-generated from CSV: ${new Date().toISOString()}
// Total stores: ${Object.keys(stores).length}

const STORES = ${JSON.stringify(stores, null, 4)};
`;

fs.writeFileSync('stores.js', storesContent);
console.log('Written to stores.js');

// Update collection-progress.json
const progress = {
    lastUpdated: new Date().toISOString().split('T')[0],
    totalStoresCollected: Object.keys(stores).length,
    statesCompleted: [...new Set(Object.values(stores).map(s => s.state.toLowerCase()))].sort(),
    statesInProgress: [],
    statesPending: [],
    stores: stores
};

fs.writeFileSync('collection-progress.json', JSON.stringify(progress, null, 2));
console.log('Updated collection-progress.json');

// Print stats by state
const byState = {};
Object.values(stores).forEach(store => {
    byState[store.state] = (byState[store.state] || 0) + 1;
});

console.log('\nStores by state:');
Object.entries(byState).sort((a, b) => b[1] - a[1]).forEach(([state, count]) => {
    console.log(`  ${state}: ${count}`);
});
