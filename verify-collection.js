/**
 * Verify Walmart Store Collection Completeness
 *
 * This script checks the collection progress and reports statistics.
 * Run with: node verify-collection.js
 */

const fs = require('fs');

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

function main() {
    console.log('===========================================');
    console.log('  Walmart Store Collection Status');
    console.log('===========================================\n');

    // Load progress file
    let progress;
    try {
        progress = JSON.parse(fs.readFileSync('collection-progress.json', 'utf8'));
    } catch (e) {
        console.log('No collection-progress.json found. Run auto-collect.js first.');
        return;
    }

    // Load stores file to count
    let stores = {};
    try {
        const content = fs.readFileSync('stores.js', 'utf8');
        const match = content.match(/const STORES = ({[\s\S]*});/);
        if (match) {
            stores = eval(`(${match[1]})`);
        }
    } catch (e) {
        console.log('Could not parse stores.js');
    }

    const totalStores = Object.keys(stores).length;
    const statesCompleted = progress.statesCompleted || [];
    const statesInProgress = progress.statesInProgress || [];
    const statesPending = progress.statesPending || [];

    console.log(`Last Updated: ${progress.lastUpdated || 'Unknown'}`);
    console.log(`Total Stores Collected: ${totalStores}`);
    console.log('');

    // State progress
    console.log('STATE PROGRESS:');
    console.log(`  Completed: ${statesCompleted.length}/${Object.keys(STATES).length}`);
    console.log(`  In Progress: ${statesInProgress.length}`);
    console.log(`  Pending: ${statesPending.length}`);
    console.log('');

    // Completed states
    if (statesCompleted.length > 0) {
        console.log('COMPLETED STATES:');
        statesCompleted.forEach(code => {
            console.log(`  ✓ ${STATES[code]} (${code.toUpperCase()})`);
        });
        console.log('');
    }

    // In progress states
    if (statesInProgress.length > 0) {
        console.log('IN PROGRESS:');
        statesInProgress.forEach(code => {
            console.log(`  ⟳ ${STATES[code]} (${code.toUpperCase()})`);
        });
        console.log('');
    }

    // Pending states
    if (statesPending.length > 0) {
        console.log('PENDING STATES:');
        statesPending.forEach(code => {
            console.log(`  ○ ${STATES[code]} (${code.toUpperCase()})`);
        });
        console.log('');
    }

    // Stores by state
    console.log('STORES BY STATE:');
    const storesByState = {};
    Object.values(stores).forEach(store => {
        const state = store.state || 'Unknown';
        if (!storesByState[state]) storesByState[state] = 0;
        storesByState[state]++;
    });

    Object.entries(storesByState)
        .sort((a, b) => b[1] - a[1])
        .forEach(([state, count]) => {
            console.log(`  ${state}: ${count} stores`);
        });

    console.log('');
    console.log('===========================================');

    // Completion percentage
    const completionPct = ((statesCompleted.length / Object.keys(STATES).length) * 100).toFixed(1);
    console.log(`Overall Progress: ${completionPct}% of states completed`);

    if (statesCompleted.length === Object.keys(STATES).length) {
        console.log('\n✓ COLLECTION COMPLETE! All states processed.');
    } else {
        console.log(`\nTo continue collection, run: node auto-collect.js`);
    }
}

main();
