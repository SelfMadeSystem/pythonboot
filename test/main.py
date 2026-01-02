from js import document, console

console.log("tp2.py loaded")

def on_button_click(event):
    console.log("Button clicked!")
    paragraph = document.getElementById("output")
    paragraph.innerHTML = "Button was clicked!"

button = document.getElementById("myButton")
button.addEventListener("click", on_button_click)
