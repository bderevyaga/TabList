"""Export an extension listing image with exact dimensions and RGB encoding."""
import argparse
from pathlib import Path
import struct
from PIL import Image, ImageColor, ImageOps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--size', choices=['1280x800', '640x400'], default='1280x800')
    parser.add_argument('--background', default='#ffffff')
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve() or args.output.exists():
        parser.error('Choose a new output file; existing files are not overwritten.')
    suffix = args.output.suffix.lower()
    if suffix not in {'.png', '.jpg', '.jpeg'}:
        parser.error('Output must end in .png, .jpg, or .jpeg.')
    size = tuple(map(int, args.size.split('x')))
    background = ImageColor.getrgb(args.background)
    with Image.open(args.source) as source:
        source = ImageOps.exif_transpose(source).convert('RGBA')
        fitted = ImageOps.contain(source, size, Image.Resampling.LANCZOS)
        canvas = Image.new('RGB', size, background)
        position = ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2)
        canvas.paste(fitted, position, fitted)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image_format = 'PNG' if suffix == '.png' else 'JPEG'
    options = {} if image_format == 'PNG' else {'quality': 95, 'subsampling': 0}
    canvas.save(args.output, format=image_format, **options)
    with Image.open(args.output) as result:
        assert result.size == size and result.mode == 'RGB' and result.format == image_format
        result.verify()
    if image_format == 'PNG':
        header = args.output.read_bytes()[:26]
        assert header[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', header[16:24]) == size
        assert header[24:26] == bytes([8, 2]), 'PNG must be 24-bit RGB without alpha.'
    print(f'{args.output.resolve()} — {size[0]}×{size[1]}, {image_format}, RGB')


if __name__ == '__main__':
    main()
