from _sitebuiltins import _Printer

__builtins__.copyright = _Printer("copyright", f"""Copyright (c) 2025 Shoghi Simon
All Rights Reserved.

{copyright}""")
__builtins__.credits = _Printer("credits", f"""    Thanks to Pyodide for making this possible.
    Thanks to UdeM's DIRO for their online Python learning environment
    which inspired me to make this project.
{credits}""")
__builtins__.license = _Printer("license", f"""pythonBoot is licensed under the MIT License.

See https://opensource.org/licenses/MIT for more information.

Python is a trademark of the Python Software Foundation.

{license}""")
