#!/usr/bin/env node

import { put, list } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('❌ BLOB_READ_WRITE_TOKEN environment variable is required');
  process.exit(1);
}

async function uploadFullVideos() {
  console.log('🚀 Uploading FULL videos to Vercel Blob...\n');
  
  const fullDir = path.join(__dirname, '..', 'public', 'videos', 'full');
  
  if (!fs.existsSync(fullDir)) {
    console.error('❌ Full videos directory not found');
    process.exit(1);
  }

  const videoFiles = fs.readdirSync(fullDir).filter(file => 
    file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mov')
  );

  console.log(`📁 Found ${videoFiles.length} full videos\n`);

  // Get existing blobs
  let existingFiles = new Set();
  try {
    const { blobs } = await list();
    existingFiles = new Set(blobs.map(blob => blob.pathname));
    console.log(`📊 Already uploaded: ${blobs.filter(b => b.pathname.startsWith('videos/full/')).length} full videos\n`);
  } catch (error) {
    console.log('⚠️  Could not list existing blobs\n');
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const fileName of videoFiles) {
    const blobPath = `videos/full/${fileName}`;
    
    // Skip if already uploaded
    if (existingFiles.has(blobPath)) {
      console.log(`⏭️  ${fileName} (already uploaded)`);
      skipped++;
      continue;
    }

    const filePath = path.join(fullDir, fileName);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    
    console.log(`📤 Uploading ${fileName} (${sizeMB} MB)...`);
    
    try {
      const fileBuffer = fs.readFileSync(filePath);
      
      const blob = await put(blobPath, fileBuffer, {
        access: 'public',
        contentType: 'video/mp4',
      });
      
      console.log(`✅ Success: ${blob.url}\n`);
      uploaded++;
    } catch (error) {
      console.error(`❌ Failed: ${error.message}\n`);
      failed++;
    }
  }

  // Update all-blob-urls.json
  try {
    const { blobs } = await list();
    const urls = {
      full: {},
      preview: {},
      other: {}
    };
    
    blobs.forEach(blob => {
      if (blob.pathname.startsWith('videos/')) {
        const path = blob.pathname.replace('videos/', '');
        
        if (path.startsWith('preview/')) {
          const fileName = path.replace('preview/', '');
          urls.preview[fileName] = blob.url;
        } else if (path.startsWith('full/')) {
          const fileName = path.replace('full/', '');
          urls.full[fileName] = blob.url;
        } else {
          urls.other[path] = blob.url;
        }
      }
    });
    
    const outputFile = path.join(__dirname, '..', 'all-blob-urls.json');
    fs.writeFileSync(outputFile, JSON.stringify(urls, null, 2));
    console.log(`📁 Updated all-blob-urls.json`);
  } catch (error) {
    console.error('Failed to update URLs file:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Upload Summary:');
  console.log(`✅ Uploaded: ${uploaded} videos`);
  console.log(`⏭️  Skipped: ${skipped} videos`);
  console.log(`❌ Failed: ${failed} videos`);
  console.log('='.repeat(50));
}

uploadFullVideos().catch(console.error);