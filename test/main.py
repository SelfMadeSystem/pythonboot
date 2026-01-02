from pyodide.ffi import to_js
from js import document, console

console.log("tp2.py loaded")

def on_button_click(event):
    console.log("Button clicked!")
    print("Button was clicked - printed from Python!")
    paragraph = document.getElementById("output")
    paragraph.innerHTML = "Button was clicked!"

button = document.getElementById("myButton")
button.addEventListener("click", to_js(on_button_click))
