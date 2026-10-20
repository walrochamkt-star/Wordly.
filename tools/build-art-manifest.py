"""Validate individual image modules and publish only complete, full-size artwork."""
from pathlib import Path
from io import BytesIO
import base64,json
from PIL import Image
root=Path(__file__).resolve().parents[1]
ready=[]
for path in sorted((root/'individual-art').glob('*.mjs')):
 if path.name=='manifest.mjs': continue
 payload=path.read_text().strip().removeprefix('export default ').removesuffix(';')
 uri=json.loads(payload)
 if not uri.startswith('data:image/webp;base64,'):raise ValueError(f'Unexpected image encoding: {path.name}')
 image=Image.open(BytesIO(base64.b64decode(uri.split(',',1)[1],validate=True)))
 if min(image.size)<1000:raise ValueError(f'Low-resolution image: {path.name} {image.size}')
 ready.append(path.stem)
(root/'individual-art'/'manifest.mjs').write_text('export default '+json.dumps(ready)+';\n')
print(json.dumps(ready))
