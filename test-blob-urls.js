import https from 'https';
import http from 'http';

const baseUrl = 'https://ml0qkja5xmbjesrt.public.blob.vercel-storage.com';
const folders = ['preview', 'full'];
const results = { preview: [], full: [] };

function testUrl(url) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const req = client.request(url, { method: 'HEAD' }, (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 300);
        });
        
        req.on('error', () => {
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            resolve(false);
        });
        
        req.end();
    });
}

async function testAllUrls() {
    console.log('Testing Blob Storage Video URLs...');
    console.log('Base URL:', baseUrl);
    
    for (const folder of folders) {
        console.log(`\nTesting ${folder} folder...`);
        
        for (let i = 1; i <= 12; i++) {
            const paddedNumber = i.toString().padStart(2, '0');
            const url = `${baseUrl}/videos/${folder}/${paddedNumber}.mp4`;
            
            process.stdout.write(`Testing ${paddedNumber}.mp4... `);
            
            const isAccessible = await testUrl(url);
            
            if (isAccessible) {
                results[folder].push(url);
                console.log('✓ FOUND');
            } else {
                console.log('✗ Not found');
            }
            
            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('FINAL RESULTS:');
    console.log('='.repeat(50));
    console.log(JSON.stringify(results, null, 2));
    console.log(`\nTotal preview videos: ${results.preview.length}`);
    console.log(`Total full videos: ${results.full.length}`);
    
    return results;
}

testAllUrls().catch(console.error);