#!/usr/bin/env node
import fs from 'fs';
import https from 'https';
import http from 'http';

const BLOB_BASE_URL = 'https://ml0qkja5xmbjesrt.public.blob.vercel-storage.com';

// Test function to check if URL exists
function checkUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.request(url, { method: 'HEAD' }, (res) => {
      resolve({
        url,
        exists: res.statusCode >= 200 && res.statusCode < 300,
        statusCode: res.statusCode,
        contentType: res.headers['content-type'],
        contentLength: res.headers['content-length']
      });
    });

    req.on('error', () => {
      resolve({
        url,
        exists: false,
        statusCode: null,
        error: 'Request failed'
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        url,
        exists: false,
        statusCode: null,
        error: 'Timeout'
      });
    });

    req.end();
  });
}

// Generate all possible URL patterns
function generateUrlPatterns() {
  const patterns = [];
  const folders = ['videos/preview', 'videos/full'];
  const extensions = ['.mp4', '.webm'];
  
  // Number patterns to test
  const numberPatterns = [];
  
  // Single digits: 1, 2, 3, ..., 9
  for (let i = 1; i <= 20; i++) {
    numberPatterns.push(i.toString());
  }
  
  // Zero-padded two digits: 01, 02, 03, ..., 20
  for (let i = 1; i <= 20; i++) {
    numberPatterns.push(i.toString().padStart(2, '0'));
  }
  
  // Zero-padded three digits: 001, 002, 003, ..., 020
  for (let i = 1; i <= 20; i++) {
    numberPatterns.push(i.toString().padStart(3, '0'));
  }
  
  // Special patterns from git status
  const specialPatterns = ['10..', 'Dikey', 'Dikey_1', 'Dikey_2', 'Dikey_2_1', 'tartormang'];
  
  // Generate URLs
  folders.forEach(folder => {
    extensions.forEach(ext => {
      // Number patterns
      numberPatterns.forEach(num => {
        patterns.push(`${BLOB_BASE_URL}/${folder}/${num}${ext}`);
      });
      
      // Special patterns
      specialPatterns.forEach(pattern => {
        patterns.push(`${BLOB_BASE_URL}/${folder}/${pattern}${ext}`);
      });
    });
  });
  
  return [...new Set(patterns)]; // Remove duplicates
}

async function checkAllVideos() {
  console.log('🔍 Checking Blob Storage videos...');
  console.log(`Base URL: ${BLOB_BASE_URL}`);
  
  const urls = generateUrlPatterns();
  console.log(`\n📊 Testing ${urls.length} URL patterns...`);
  
  const results = {
    timestamp: new Date().toISOString(),
    baseUrl: BLOB_BASE_URL,
    summary: {
      total: urls.length,
      found: 0,
      notFound: 0
    },
    videos: {
      preview: [],
      full: []
    },
    allResults: []
  };
  
  // Check URLs in batches to avoid overwhelming the server
  const batchSize = 10;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(checkUrl));
    
    batchResults.forEach(result => {
      results.allResults.push(result);
      
      if (result.exists) {
        console.log(`✅ ${result.url} (${result.contentLength} bytes)`);
        results.summary.found++;
        
        // Categorize by folder
        if (result.url.includes('/videos/preview/')) {
          const filename = result.url.split('/videos/preview/')[1];
          results.videos.preview.push({
            filename,
            url: result.url,
            contentType: result.contentType,
            contentLength: result.contentLength
          });
        } else if (result.url.includes('/videos/full/')) {
          const filename = result.url.split('/videos/full/')[1];
          results.videos.full.push({
            filename,
            url: result.url,
            contentType: result.contentType,
            contentLength: result.contentLength
          });
        }
      } else {
        results.summary.notFound++;
        if (result.error !== 'Timeout') {
          console.log(`❌ ${result.url} (${result.statusCode || result.error})`);
        }
      }
    });
    
    // Small delay between batches
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Sort results by filename
  results.videos.preview.sort((a, b) => a.filename.localeCompare(b.filename));
  results.videos.full.sort((a, b) => a.filename.localeCompare(b.filename));
  
  console.log(`\n📈 Summary:`);
  console.log(`   Found: ${results.summary.found} videos`);
  console.log(`   Not found: ${results.summary.notFound} URLs`);
  console.log(`   Preview videos: ${results.videos.preview.length}`);
  console.log(`   Full videos: ${results.videos.full.length}`);
  
  return results;
}

async function main() {
  try {
    const results = await checkAllVideos();
    
    // Save results to JSON file
    const outputFile = 'blob-storage-videos.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to ${outputFile}`);
    
    // Also create a simplified version for constants.ts
    const simplifiedResults = {
      preview: results.videos.preview.map(v => ({
        filename: v.filename,
        url: v.url
      })),
      full: results.videos.full.map(v => ({
        filename: v.filename,
        url: v.url
      }))
    };
    
    const simplifiedFile = 'blob-storage-videos-simple.json';
    fs.writeFileSync(simplifiedFile, JSON.stringify(simplifiedResults, null, 2));
    console.log(`💾 Simplified results saved to ${simplifiedFile}`);
    
    // Print found videos
    if (results.videos.preview.length > 0) {
      console.log(`\n🎬 Preview Videos Found:`);
      results.videos.preview.forEach(video => {
        console.log(`   ${video.filename} - ${video.url}`);
      });
    }
    
    if (results.videos.full.length > 0) {
      console.log(`\n🎬 Full Videos Found:`);
      results.videos.full.forEach(video => {
        console.log(`   ${video.filename} - ${video.url}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();