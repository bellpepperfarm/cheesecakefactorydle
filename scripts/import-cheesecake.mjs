// Preserve menu.json as the external source. Write normalized input to stdout.
import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync(process.argv[2] || 'menu.json'));
const lunchNames = new Set(raw.categories.filter(category => category.name === 'Lunch Favorites').flatMap(category => category.products || []).map(item => item.name.trim()));
const products = raw.categories.flatMap(category => (category.products || []).map(item => ({
    id: String(item.id), name: item.name?.trim(), description: (item.description || '').trim(),
    category: category.name, basecalories: Number(item.basecalories), maxcalories: item.maxcalories ? Number(item.maxcalories) : null,
    portion: category.name === 'Lunch Favorites' ? 'Lunch portion' : lunchNames.has(item.name?.trim()) ? 'Regular portion' : category.name === 'Appetizers' ? 'Full order · not per person' : category.name,
    imagefilename: item.imagefilename,
    ...(item.imagefilename && fs.existsSync(`images/${item.imagefilename.split('?')[0].split('/').at(-1)}`) ? { localImage: `images/${item.imagefilename.split('?')[0].split('/').at(-1)}` } : {})
}))).filter(item => item.imagefilename && item.name);
process.stdout.write(JSON.stringify({ schemaVersion: 1, imagepath: raw.imagepath, imageCredit: '© The Cheesecake Factory', products }, null, 2) + '\n');
