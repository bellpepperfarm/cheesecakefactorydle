"""Slice the supplied transparent wordmark without redrawing any letters.

Run with Python 3 and Pillow: python3 scripts/slice-caloriedle.py
The fixed cuts follow the transparent gaps in caloriedlefoodgood.png.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = Image.open(root / 'caloriedlefoodgood.png')
if source.size != (2500, 1800) or source.mode != 'RGBA':
    raise ValueError('Expected the original 2500 × 1800 RGBA artwork')
cuts = [130, 417, 690, 825, 1080, 1333, 1465, 1703, 1975, 2109, 2345]
output = root / 'assets' / 'caloriedle'
output.mkdir(parents=True, exist_ok=True)
for index, letter in enumerate('caloriedle'):
    # Common top/bottom preserves the original baseline and includes the i dot.
    source.crop((cuts[index], 695, cuts[index + 1], 1148)).save(
        output / f'{index + 1:02d}-{letter}.webp', lossless=True, method=6)
