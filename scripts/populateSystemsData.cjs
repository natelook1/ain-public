/**
 * scripts/populateSystemsData.js
 * 
 * Reads mapSolarSystems.jsonl, optimizes the data (English only),
 * and writes it to src/components/Starmap/systemsData.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INPUT_FILE = path.join(__dirname, '..', 'mapSolarSystems.jsonl');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'components', 'Starmap', 'systemsData.js');

async function generate() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Error: Input file not found at ${INPUT_FILE}`);
        process.exit(1);
    }

    const fileStream = fs.createReadStream(INPUT_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const systems = [];
    console.log('Processing systems...');

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const raw = JSON.parse(line);
            
            // OPTIMIZATION: Flatten name to English string only
            // This saves significant space and processing time on the frontend
            const optimizedSystem = {
                ...raw,
                name: raw.name && raw.name.en ? raw.name.en : raw.name
            };

            systems.push(optimizedSystem);
        } catch (e) {
            console.warn('Skipping invalid JSON line');
        }
    }

    console.log(`Processed ${systems.length} systems.`);
    
    // Write as a JavaScript module
    const content = `// Auto-generated from mapSolarSystems.jsonl\nexport const systemsData = ${JSON.stringify(systems, null, 0)};\n`;
    
    // Ensure directory exists
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, content);
    console.log(`Successfully wrote to ${OUTPUT_FILE}`);
}

generate().catch(err => console.error(err));
