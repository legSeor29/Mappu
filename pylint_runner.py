#!/usr/bin/env python
"""
Script to run pylint on the entire Django project.
Usage: python pylint_runner.py [options]
"""

import os
import sys
import subprocess
import argparse
import shutil
import tempfile

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Run pylint on the Django project')
    parser.add_argument('--html', action='store_true', 
                        help='Generate HTML report')
    parser.add_argument('--output', type=str, default='pylint_report.html',
                        help='Output file for HTML report (default: pylint_report.html)')
    parser.add_argument('--threshold', type=float, default=7.0,
                        help='Score threshold for pass/fail (default: 7.0)')
    parser.add_argument('--apps', nargs='+', default=['WireMap', 'MainApp'],
                        help='Django apps to lint (default: WireMap MainApp)')
    parser.add_argument('--disable', nargs='+', default=[],
                        help='Disable specific pylint checkers')
    parser.add_argument('--no-plugins', action='store_true',
                        help='Disable all plugins')
    parser.add_argument('--ignore-config', action='store_true',
                        help='Ignore .pylintrc configuration file')
    return parser.parse_args()

def run_pylint(args):
    """Run pylint on specified Django apps."""
    base_cmd = ['pylint']
    
    # Handle .pylintrc file
    pylintrc_path = '.pylintrc'
    pylintrc_backup = None
    
    try:
        if args.ignore_config and os.path.exists(pylintrc_path):
            # Temporarily move .pylintrc to prevent pylint from using it
            temp_dir = tempfile.gettempdir()
            pylintrc_backup = os.path.join(temp_dir, f'.pylintrc_backup_{os.getpid()}')
            shutil.move(pylintrc_path, pylintrc_backup)
            print(f"Temporarily moved .pylintrc to {pylintrc_backup}")
        elif os.path.exists(pylintrc_path):
            print("Using configuration from .pylintrc")
        
        # Add HTML report option if requested
        if args.html:
            base_cmd.extend(['--output-format=html', f'--output={args.output}'])
        
        # Disable all plugins if requested
        if args.no_plugins:
            base_cmd.extend(['--load-plugins='])
            
        # Add disable options if any
        if args.disable:
            base_cmd.extend(['--disable', ','.join(args.disable)])
        
        # Add apps to lint
        base_cmd.extend(args.apps)
        
        print(f"Running pylint on: {' '.join(args.apps)}")
        print(f"Command: {' '.join(base_cmd)}")
        
        try:
            result = subprocess.run(base_cmd, check=False, capture_output=True, text=True)
            
            # Print output
            if result.stdout:
                print("\nPylint output:")
                print(result.stdout)
            
            if result.stderr:
                print("\nPylint errors:")
                print(result.stderr)
                
            # Extract score from output
            score = None
            for line in result.stdout.split('\n'):
                if 'Your code has been rated at' in line:
                    score_part = line.split('Your code has been rated at ')[1].split('/10')[0]
                    try:
                        score = float(score_part)
                        print(f"\nPylint score: {score}/10.0")
                        break
                    except ValueError:
                        pass
            
            # Check against threshold
            if score is not None and score < args.threshold:
                print(f"Pylint score {score} is below threshold {args.threshold}")
                return False
                
            return result.returncode == 0
            
        except subprocess.CalledProcessError as e:
            print(f"Error running pylint: {e}")
            return False
        except FileNotFoundError:
            print("Error: pylint not found. Please install it with 'pip install pylint'")
            return False
    finally:
        # Restore .pylintrc if we moved it
        if pylintrc_backup and os.path.exists(pylintrc_backup):
            shutil.move(pylintrc_backup, pylintrc_path)
            print(f"Restored .pylintrc from {pylintrc_backup}")

def main():
    """Main function."""
    args = parse_args()
    success = run_pylint(args)
    
    if success:
        print("\nPylint check passed!")
        return 0
    else:
        print("\nPylint check failed!")
        return 1

if __name__ == '__main__':
    sys.exit(main()) 