const fonts = await figma.listAvailableFontsAsync();
const patterns = ['Serif', 'Cormorant', 'Playfair', 'Bodoni', 'Didot', 'Garamond', 'Times', 'Song', '宋', 'Noto Serif', 'Source Han Serif', 'Lora', 'DM Serif'];
const families = [...new Set(fonts.map(item => item.fontName.family))]
  .filter(family => patterns.some(pattern => family.toLowerCase().includes(pattern.toLowerCase())))
  .sort();
const result = {};
for (const family of families.slice(0, 80)) {
  result[family] = fonts.filter(item => item.fontName.family === family).map(item => item.fontName.style);
}
return result;
