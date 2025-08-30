let score = document.getElementById("score")
let checkBtn = document.getElementById("check-btn")
let result = document.getElementById("result")

checkBtn.addEventListener("click",()=>{
    let marks = score.value;
    if(marks === ""){
        result.innerText = "Enter some marks";
    }
    else if (marks <=100 && marks >= 90) {
        result.innerHTML = "Your grade is <strong>A</strong>";        
    }
    else if (marks <=89 && marks >= 80) {
        result.innerHTML = "Your grade is <strong>B</strong>";       
    }
    else if (marks <=79 && marks >= 70) {
        result.innerHTML = "Your grade is <strong>C</strong>";        
    }
    else if (marks <=69 && marks >= 60) {
        result.innerHTML = "Your grade is <strong>D</strong>";        
    }
    else if (marks <=59 && marks > 0) {
        result.innerHTML = "Your grade is <strong>E</strong>";     
    }
    else{
        result.innerText = "Please enter a value between 0 and 100"
    }
})