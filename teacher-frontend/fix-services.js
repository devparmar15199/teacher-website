const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'src', 'services');
const files = fs.readdirSync(servicesDir)
  .filter(f => f.endsWith('.js') && f !== 'api.js');

let fixedCount = 0;

files.forEach(file => {
  const filePath = path.join(servicesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Remove /api prefix from all API calls
  content = content.replace(/api\.get\('\/api\//g, "api.get('/");
  content = content.replace(/api\.post\('\/api\//g, "api.post('/");
  content = content.replace(/api\.put\('\/api\//g, "api.put('/");
  content = content.replace(/api\.delete\('\/api\//g, "api.delete('/");
  content = content.replace(/api\.patch\('\/api\//g, "api.patch('/");
  content = content.replace(/api\.get\("\/api\//g, 'api.get("/');
  content = content.replace(/api\.post\("\/api\//g, 'api.post("/');
  content = content.replace(/api\.put\("\/api\//g, 'api.put("/');
  content = content.replace(/api\.delete\("\/api\//g, 'api.delete("/');
  content = content.replace(/api\.patch\("\/api\//g, 'api.patch("/');
  content = content.replace(/api\.get\(`\/api\//g, "api.get(`/");
  content = content.replace(/api\.post\(`\/api\//g, "api.post(`/");
  content = content.replace(/api\.put\(`\/api\//g, "api.put(`/");
  content = content.replace(/api\.delete\(`\/api\//g, "api.delete(`/");
  content = content.replace(/api\.patch\(`\/api\//g, "api.patch(`/");
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed: ${file}`);
    fixedCount++;
  } else {
    console.log(`  No changes: ${file}`);
  }
});

console.log(`\nDone! Fixed ${fixedCount} out of ${files.length} files.`);
