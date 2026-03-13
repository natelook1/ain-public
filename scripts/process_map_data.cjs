const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const INPUT_FILENAME = 'mapSolarSystems.jsonl';
const OUTPUT_DIR = 'public/data';
const OUTPUT_FILENAME = 'systems.json';

// Paths (Assumes script is in /scripts and input is in root)
const inputPath = path.join(__dirname, '..', INPUT_FILENAME);
const outputDirPath = path.join(__dirname, '..', OUTPUT_DIR);
const outputPath = path.join(outputDirPath, OUTPUT_FILENAME);

console.log(`Reading from: ${inputPath}`);

// 1. Check Input
if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: Input file not found at ${inputPath}`);
    console.log(`   Please ensure '${INPUT_FILENAME}' is in the project root directory.`);
    process.exit(1);
}

// 2. Prepare Output Directory
if (!fs.existsSync(outputDirPath)) {
    console.log(`   Creating directory: ${outputDirPath}`);
    fs.mkdirSync(outputDirPath, { recursive: true });
}

// 3. Process File Line-by-Line (Memory Efficient)
const systems = [];
const fileStream = fs.createReadStream(inputPath);
const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
});

rl.on('line', (line) => {
    if (!line.trim()) return;
    
    try {
        const data = JSON.parse(line);
        
        // Extract only what the frontend needs to keep file size down
        const sys = {
            id: data._key,
            name: data.name.en,
            regionId: data.regionID,
            constellationId: data.constellationID,
            sec: parseFloat(data.securityStatus.toFixed(4)),
            // 3D Coordinates
            x: Math.round(data.position.x),
            y: Math.round(data.position.y),
            z: Math.round(data.position.z),
            // 2D Schematic Coordinates (if available)
            x2d: data.position2D ? Math.round(data.position2D.x) : undefined,
            y2d: data.position2D ? Math.round(data.position2D.y) : undefined
        };
        
        systems.push(sys);
    } catch (e) {
        console.warn(`⚠️ Skipping invalid JSON line`);
    }
});

rl.on('close', () => {
    // 4. Write Result
    try {
        fs.writeFileSync(outputPath, JSON.stringify(systems));
        console.log(`✅ Success! Processed ${systems.length} systems.`);
        console.log(`   Output saved to: ${outputPath}`);
    } catch (err) {
        console.error(`❌ Error writing file: ${err.message}`);
    }
});
