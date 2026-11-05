"""
Tight, thick, collision-free headband generator for Gymmy the Mascot.
Hugs the forehead tight, 3.8 mm solid athletic fabric, 0 collisions, perfectly upright and right-reading CleanRep logo.
"""
import subprocess
import sys

if __name__ == '__main__':
    subprocess.check_call([sys.executable, 'scripts/build_thick_bandana_master.py'])
