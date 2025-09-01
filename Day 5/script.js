let themeBtn = document.querySelector("#theme-btn");
let themeBox = document.querySelector("#theme-box");
let knowTheme = document.querySelector("#know-theme");
let changeImage = document.querySelector("#change-image");
let body = document.querySelector("body");
let isLight = true;

themeBtn.addEventListener("click", () => {
  if (isLight !== false) {
    
        body.style.background = "linear-gradient(120deg, #746f6fff, #33393dff)";
    
    
    themeBox.style.color = "#fff";
    themeBox.style.backgroundColor = "transparent";
    knowTheme.style.margin = "3px";
    knowTheme.innerHTML = "Switched to dark mode";
    
    changeImage.style.opacity = "0";
    setTimeout(() => {
        changeImage.src = "moon.png";
        changeImage.style.opacity = "1";
    }, 200);
    isLight = false;
    } 

    else {
        
            body.style.background = "linear-gradient(135deg, #f7f6f6,#8faac2ff)";
        
        
        themeBox.style.color = "#000";
        knowTheme.innerHTML = "Switched to light mode";
        themeBox.style.backgroundColor = "transparent";
        
        changeImage.style.opacity = "0";
        setTimeout(() => {
            changeImage.src = "sleep-mode.png";
            changeImage.style.opacity = "1";
        }, 200);
        
        isLight = true;
    }
});
