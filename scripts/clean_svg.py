import os
import re
import base64

def process_svg(input_file, output_file):
    if not os.path.exists(input_file):
        print(f"Error: Could not find {input_file}")
        return

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. REMOVE WATERMARK (Dynamically)
    # We look for the <g> tag that ends in "28" and contains their specific scale matrix
    content = re.sub(r'<g id="[a-zA-Z0-9_]+28" transform="matrix\(0\.424286.*?</svg>', '</svg>', content, flags=re.DOTALL)

    # 2. DECODE CSS & BREAK ANTI-TAMPER LOCKS
    b64_match = re.search(r'@import "data:text/css;base64,([^"]+)";?', content)
    if b64_match:
        css_b64 = b64_match.group(1)
        # Pad base64 string to ensure proper decoding
        css_b64 += "=" * ((4 - len(css_b64) % 4) % 4) 
        decoded_css = base64.b64decode(css_b64).decode('utf-8')
        
        # This strips out `svg[viewBox="..."]:has(...):has(...) #element` 
        # leaving ONLY `#element {` so animations run freely without the watermark.
        clean_css = re.sub(r'svg\[viewBox[^\{]+?(#[\w_]+)\s*\{', r'\1 {', decoded_css)
        
        # 3. FORCE INFINITE LOOP
        # Changes SVGator's "play once" (1 normal) to loop forever
        clean_css = clean_css.replace('1 normal forwards', 'infinite normal forwards')
        clean_css = clean_css.replace('1 normal both', 'infinite normal both')
        
        # Replace the entire <style> block with our unlocked React-safe CSS
        content = re.sub(r'<style>.*?</style>', f'<style dangerouslySetInnerHTML={{{{ __html: `{clean_css}` }}}} />', content, flags=re.DOTALL)

    # 4. FIX REACT CRASH: Strip redundant `style="..."` attributes completely
    # SVGator duplicates base attributes (like fill, opacity, d) inside inline styles.
    # Stripping these removes the bloat and fixes the React crash immediately.
    content = re.sub(r'\sstyle="[^"]+"', '', content)

    # 5. DYNAMIC COLORS: Replace hardcoded blue with currentColor
    content = content.replace('#2012e9', 'currentColor')

    # 6. INJECT PROPS into root tag
    content = content.replace('<svg ', '<svg {...props} ')

    # 7. FORMAT JSX ATTRIBUTES
    svg_attributes = {
        'shape-rendering': 'shapeRendering',
        'text-rendering': 'textRendering',
        'project-id': 'projectId',
        'export-id': 'exportId',
        'stroke-width': 'strokeWidth',
        'stroke-linecap': 'strokeLinecap',
        'stroke-dashoffset': 'strokeDashoffset',
        'stroke-dasharray': 'strokeDasharray',
        'stroke-linejoin': 'strokeLinejoin',
        'xmlns:xlink': 'xmlnsXlink',
        'fill-rule': 'fillRule',
        'clip-rule': 'clipRule',
        'fill-opacity': 'fillOpacity',
        'stroke-opacity': 'strokeOpacity',
        'transform-origin': 'transformOrigin'
    }
    
    for kebab, camel in svg_attributes.items():
        content = content.replace(f'{kebab}="', f'{camel}="')

    # 8. EXPORT REACT COMPONENT
    react_component = f"""import React from 'react';

export const B4CSpinner: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  {content}
);

export default B4CSpinner;
"""

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(react_component)
    
    print(f"✅ Successfully unlocked CSS, fixed React style errors, forced loops, and saved to {output_file}")

if __name__ == "__main__":
    INPUT = "B4CLogo.svg"
    OUTPUT = "../frontend/src/components/ui/B4CSpinner.tsx"
    process_svg(INPUT, OUTPUT)