#!/usr/bin/env python3
"""Recreate the original geometric PNG with Python's standard library."""
import argparse
from pathlib import Path
import struct
import zlib


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=Path(__file__).resolve().parents[1] / 'assets/demo-prism.png')
    args = parser.parse_args()
    facets = [('#8dc4ed', ((256,38),(65,181),(256,266))),
              ('#5998c6', ((256,38),(447,181),(256,266))),
              ('#315775', ((65,181),(256,266),(256,474))),
              ('#467da4', ((447,181),(256,266),(256,474)))]
    pixels = bytearray(512 * 512 * 4)
    def edge(a,b,p):
        return (p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0])
    for colour, (a,b,c) in facets:
        rgba = bytes.fromhex(colour[1:]) + b'\xff'
        for y in range(min(a[1],b[1],c[1]),max(a[1],b[1],c[1])+1):
            for x in range(min(a[0],b[0],c[0]),max(a[0],b[0],c[0])+1):
                signs = [edge(a,b,(x+.5,y+.5)),edge(b,c,(x+.5,y+.5)),edge(c,a,(x+.5,y+.5))]
                if min(signs)>=0 or max(signs)<=0:
                    i=(y*512+x)*4;pixels[i:i+4]=rgba
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data))
    scanlines=b''.join(b'\0'+pixels[y*2048:(y+1)*2048] for y in range(512))
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',512,512,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scanlines))+chunk(b'IEND',b'')
    args.out.parent.mkdir(parents=True,exist_ok=True)
    with args.out.open('xb') as output:
        output.write(png)
    print(args.out)


if __name__ == '__main__':
    main()
